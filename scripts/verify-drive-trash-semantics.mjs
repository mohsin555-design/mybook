#!/usr/bin/env node

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const MYBOOK_MARKDOWN_MIME = 'text/markdown'
const CONFIRMATION = 'DELETE_TEST_ROOT'
const METADATA_FIELDS = 'id,name,mimeType,parents,trashed,explicitlyTrashed,appProperties,modifiedTime'

const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim()
const confirmed = process.env.MYBOOK_DRIVE_TRASH_HARNESS_CONFIRM === CONFIRMATION

if (!accessToken || !confirmed) {
  console.error(`
Mybook Drive Trash Semantics Harness

This is a developer-only live Google Drive verification script.
It creates a dedicated temporary test root outside the normal Mybook workspace,
runs trash/restore probes, prints paste-friendly JSON, then permanently deletes
only the dedicated test root.

Required environment:
  GOOGLE_DRIVE_ACCESS_TOKEN=<short-lived OAuth access token>
  MYBOOK_DRIVE_TRASH_HARNESS_CONFIRM=${CONFIRMATION}

Run:
  GOOGLE_DRIVE_ACCESS_TOKEN="..." \\
  MYBOOK_DRIVE_TRASH_HARNESS_CONFIRM=${CONFIRMATION} \\
  npm run verify:drive-trash

Current Mybook browser OAuth scope:
  https://www.googleapis.com/auth/drive.file

The token must allow creating folders/files, setting appProperties, trashing,
restoring, listing trashed items, downloading created .mybook.md files, and
deleting the isolated test root during cleanup.
`)
  process.exit(1)
}

const createdIds = []
const report = {
  harness: {
    type: 'standalone dev-only script',
    productionBehaviorChanged: false,
    currentMybookBrowserScope: 'https://www.googleapis.com/auth/drive.file',
    testRootSafety: 'Creates a dedicated root folder in Drive root and only cleans up IDs it created.',
  },
  created: {},
  initialMetadata: {},
  scenarioAParentOnlyTrash: {},
  scenarioBParentRestore: {},
  scenarioCIndependentChild: {},
  scenarioDNestedIndependentTrash: {},
  appProperties: {},
  trashedDocument: {},
  trashedListing: {},
  parentAvailability: {},
  cleanup: {},
  errors: [],
}

function section(title, data) {
  console.log(`\n=== ${title} ===`)
  console.log(JSON.stringify(data, null, 2))
}

function bearerHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  }
}

async function driveJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...bearerHeaders(init.headers ?? {}),
    },
  })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${response.status} ${response.statusText} ${JSON.stringify(body)}`)
  }
  return body
}

async function driveText(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...bearerHeaders(init.headers ?? {}),
    },
  })
  const body = await response.text().catch(() => '')
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${response.status} ${response.statusText} ${body}`)
  }
  return body
}

async function createFolder(name, parentId, appProperties = {}) {
  const body = {
    name,
    mimeType: DRIVE_FOLDER_MIME,
    parents: [parentId],
    appProperties,
  }
  const folder = await driveJson(`${DRIVE_API_BASE}/files?fields=${encodeURIComponent(METADATA_FIELDS)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  createdIds.push(folder.id)
  return folder
}

async function createMarkdownFile(name, parentId, content) {
  const boundary = `mybook-trash-harness-${Date.now()}`
  const metadata = {
    name,
    parents: [parentId],
    mimeType: MYBOOK_MARKDOWN_MIME,
  }
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${MYBOOK_MARKDOWN_MIME}; charset=UTF-8\r\n\r\n${content}\r\n`,
    `--${boundary}--`,
  ].join('')
  const file = await driveJson(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=${encodeURIComponent(METADATA_FIELDS)}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  createdIds.push(file.id)
  return file
}

async function getMetadata(id) {
  return await driveJson(`${DRIVE_API_BASE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(METADATA_FIELDS)}`)
}

async function setTrashed(id, trashed) {
  await driveJson(`${DRIVE_API_BASE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(METADATA_FIELDS)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }),
  })
  return getMetadata(id)
}

async function permanentlyDelete(id) {
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: bearerHeaders(),
  })
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '')
    throw new Error(`DELETE ${id} failed: ${response.status} ${response.statusText} ${body}`)
  }
}

async function listTrashedChildren(parentId) {
  const fields = `files(${METADATA_FIELDS})`
  const query = `'${parentId}' in parents and trashed=true`
  const data = await driveJson(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&spaces=drive`)
  return data.files ?? []
}

async function downloadFile(id) {
  return driveText(`${DRIVE_API_BASE}/files/${encodeURIComponent(id)}?alt=media`)
}

async function capture(idsByName) {
  const entries = await Promise.all(Object.entries(idsByName).map(async ([name, id]) => [name, await getMetadata(id)]))
  return Object.fromEntries(entries)
}

async function createScenarioRoot(name) {
  return createFolder(name, report.created.testRootId, {})
}

async function createFlatHierarchy(prefix) {
  const root = await createScenarioRoot(prefix)
  const a = await createFolder(`${prefix} A`, root.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-a` })
  const b = await createFolder(`${prefix} B`, a.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-b` })
  const c = await createFolder(`${prefix} C`, a.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-c` })
  return { root, a, b, c }
}

async function createNestedHierarchy(prefix) {
  const root = await createScenarioRoot(prefix)
  const a = await createFolder(`${prefix} A`, root.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-a` })
  const b = await createFolder(`${prefix} B`, a.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-b` })
  const c = await createFolder(`${prefix} C`, b.id, { mybookFolderId: `${prefix.toLowerCase()}-folder-test-c` })
  return { root, a, b, c }
}

async function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const testRoot = await createFolder(`Mybook Trash Semantics Test - ${timestamp}`, 'root', {
    purpose: 'mybook-trash-semantics-harness',
  })
  report.created.testRootId = testRoot.id
  report.created.testRootName = testRoot.name

  const initialA = await createFolder('A', testRoot.id, { mybookFolderId: 'folder-test-a' })
  const initialB = await createFolder('B', initialA.id, { mybookFolderId: 'folder-test-b' })
  const initialC = await createFolder('C', initialA.id, { mybookFolderId: 'folder-test-c' })
  const docContent = `---\nmybook_version: 1\ntype: document\ntitle: "Trash Test"\ndocument_id: "doc-trash-test"\n---\n\nTrash test document.\n`
  const testDocument = await createMarkdownFile('test-document.mybook.md', testRoot.id, docContent)
  report.created.initialIds = { A: initialA.id, B: initialB.id, C: initialC.id, document: testDocument.id }
  report.initialMetadata = await capture({ A: initialA.id, B: initialB.id, C: initialC.id, document: testDocument.id })
  section('Initial Metadata', report.initialMetadata)

  const scenarioA = await createFlatHierarchy('Scenario A')
  await setTrashed(scenarioA.a.id, true)
  report.scenarioAParentOnlyTrash = await capture({ A: scenarioA.a.id, B: scenarioA.b.id, C: scenarioA.c.id })
  section('Scenario A - Parent-Only Trash', report.scenarioAParentOnlyTrash)

  await setTrashed(scenarioA.a.id, false)
  report.scenarioBParentRestore = await capture({ A: scenarioA.a.id, B: scenarioA.b.id, C: scenarioA.c.id })
  section('Scenario B - Parent Restore', report.scenarioBParentRestore)

  const scenarioC = await createFlatHierarchy('Scenario C')
  await setTrashed(scenarioC.b.id, true)
  report.scenarioCIndependentChild.beforeParentTrash = await capture({ A: scenarioC.a.id, B: scenarioC.b.id, C: scenarioC.c.id })
  await setTrashed(scenarioC.a.id, true)
  report.scenarioCIndependentChild.afterParentTrash = await capture({ A: scenarioC.a.id, B: scenarioC.b.id, C: scenarioC.c.id })
  await setTrashed(scenarioC.a.id, false)
  report.scenarioCIndependentChild.afterParentRestore = await capture({ A: scenarioC.a.id, B: scenarioC.b.id, C: scenarioC.c.id })
  section('Scenario C - Independently Trashed Child', report.scenarioCIndependentChild)

  const scenarioD = await createNestedHierarchy('Scenario D')
  await setTrashed(scenarioD.b.id, true)
  report.scenarioDNestedIndependentTrash.afterBTrash = await capture({ A: scenarioD.a.id, B: scenarioD.b.id, C: scenarioD.c.id })
  await setTrashed(scenarioD.a.id, true)
  report.scenarioDNestedIndependentTrash.afterATrash = await capture({ A: scenarioD.a.id, B: scenarioD.b.id, C: scenarioD.c.id })
  await setTrashed(scenarioD.a.id, false)
  report.scenarioDNestedIndependentTrash.afterARestore = await capture({ A: scenarioD.a.id, B: scenarioD.b.id, C: scenarioD.c.id })
  section('Scenario D - Nested Independent Trash', report.scenarioDNestedIndependentTrash)

  report.appProperties = {
    beforeTrash: report.scenarioCIndependentChild.beforeParentTrash.B?.appProperties ?? null,
    whileTrashed: report.scenarioCIndependentChild.afterParentTrash.B?.appProperties ?? null,
    afterRestore: report.scenarioCIndependentChild.afterParentRestore.B?.appProperties ?? null,
  }
  section('App Properties Persistence', report.appProperties)

  await setTrashed(testDocument.id, true)
  const documentMetadata = await getMetadata(testDocument.id)
  const downloaded = await downloadFile(testDocument.id)
  report.trashedDocument = {
    metadata: documentMetadata,
    downloaded,
    recoveredDocumentId: downloaded.match(/document_id:\s*["']?([^"'\n]+)["']?/u)?.[1] ?? null,
  }
  section('Trashed Document Download', report.trashedDocument)

  report.trashedListing = {
    query: "'<parentId>' in parents and trashed=true",
    testRootTrashedChildren: await listTrashedChildren(testRoot.id),
    scenarioATrashedChildrenAfterRestore: await listTrashedChildren(scenarioA.a.id),
    scenarioCTrashedChildrenAfterRestore: await listTrashedChildren(scenarioC.a.id),
  }
  section('Trashed Item Listing', report.trashedListing)

  const trashedStates = [
    ...Object.values(report.scenarioAParentOnlyTrash),
    ...Object.values(report.scenarioCIndependentChild.afterParentTrash),
    ...Object.values(report.scenarioCIndependentChild.afterParentRestore),
    report.trashedDocument.metadata,
  ].filter(Boolean)
  report.parentAvailability = {
    parentsAvailableWhileTrashed: trashedStates
      .filter((item) => item.trashed)
      .every((item) => Array.isArray(item.parents) && item.parents.length > 0),
    trashedStates: trashedStates.filter((item) => item.trashed).map((item) => ({
      id: item.id,
      name: item.name,
      parents: item.parents,
      trashed: item.trashed,
      explicitlyTrashed: item.explicitlyTrashed,
    })),
  }
  section('Parents While Trashed', report.parentAvailability)
}

try {
  await run()
} catch (error) {
  report.errors.push(error instanceof Error ? error.message : String(error))
  section('Harness Error', { errors: report.errors, createdIds, testRootId: report.created.testRootId ?? null })
  process.exitCode = 1
} finally {
  if (report.created.testRootId) {
    try {
      await permanentlyDelete(report.created.testRootId)
      report.cleanup = { success: true, deletedTestRootId: report.created.testRootId }
    } catch (error) {
      report.cleanup = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        createdIds,
        manualCleanupInstruction: 'Delete only these harness-created Drive IDs manually.',
      }
      process.exitCode = 1
    }
    section('Cleanup Result', report.cleanup)
  }

  section('Final Paste-Friendly Report', report)
}
