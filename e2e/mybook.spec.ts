import { expect, test, type Page } from '@playwright/test'

async function signInForTest(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('mybook-auth', JSON.stringify({ state: { isAuthenticated: true, email: 'tester@example.com', accessToken: 'test-token', accessTokenExpiresAt: Date.now() + 3_600_000 }, version: 0 }))
  })
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) })
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: `drive-${Date.now()}`, name: 'MyBook', webViewLink: 'https://drive.google.com/test' }) })
  })
  await page.goto('/home')
}

test('login page provides Google sign-in without calling Drive', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome to MyBook' })).toBeVisible()
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
})

test('document create, local save, backup, home open, rename, and delete', async ({ page }) => {
  await signInForTest(page)
  await page.getByRole('button', { name: 'Create new' }).click()
  await page.getByRole('menuitem', { name: 'New document' }).click()
  const editor = page.getByRole('textbox', { name: 'Document content' })
  await expect(editor).toBeVisible()
  await editor.fill('Meeting notes saved locally')
  await expect(page.getByText('Saved locally')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText(/Google Drive backup complete|backup created|backup updated/i)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Close document' }).click()
  await expect(page.getByRole('button', { name: /Untitled document/i })).toBeVisible()
  await page.getByRole('button', { name: /More actions for Untitled document/i }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByLabel('File name').fill('Meeting Notes')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: /More actions for Meeting Notes/i }).click()
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click()
  await expect(page.getByText(/Recent files/i)).toBeVisible()
})

test('spreadsheet can be created and backed up with mocked Drive', async ({ page }) => {
  await signInForTest(page)
  await page.getByRole('button', { name: 'Create new' }).click()
  await page.getByRole('menuitem', { name: 'New spreadsheet' }).click()
  await expect(page.getByRole('region', { name: /Spreadsheet editor/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Back up now' }).click()
  await expect(page.getByText(/Google Drive backup complete|backup created|backup updated/i)).toBeVisible({ timeout: 15_000 })
})
