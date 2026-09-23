import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import { TableKit } from '@tiptap/extension-table'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'

import { CodeBlock } from '../../document-editor/extensions/CodeBlock'
import { Callout } from '../../document-editor/extensions/Callout'
import { ToggleBlock } from '../../document-editor/extensions/ToggleBlock'
import { FixedTable } from '../../document-editor/extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from '../../document-editor/extensions/TableCellStyles'
import { TableInteraction } from '../../document-editor/extensions/TableInteraction'
import { Button } from '../../ui/button'

export interface LabEditorMethods {
  replaceSelection: (text: string) => void
  insertBelowSelection: (text: string) => void
  insertBlocks: (blocks: JSONContent[]) => void
  getSelectedText: () => string
  getAllText: () => string
}

const SAMPLE_LAB_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Local Writing Intelligence Workspace' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Welcome to the ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Writin Local Intelligence Lab' },
        { type: 'text', text: '. This sandbox environment lets you evaluate ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'on-device neural writing tools' },
        { type: 'text', text: ', semantic embeddings, classification, and OCR ' },
        { type: 'text', marks: [{ type: 'underline' }], text: 'without sending any data across the network' },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Quarterly Objectives & Key Results' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'In order to maximize our team productivity for the upcoming fiscal quarter, it is absolutely essential that we prioritize client-side machine learning capabilities. Due to the fact that user privacy is our foremost guiding principle, zero telemetry regarding document contents shall ever leave the user device.',
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Benchmark WebGPU execution speeds across modern browsers' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Evaluate 0.5B quantized instruction models for tone refinement' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test local OCR parsing for printed meeting handouts' }] }],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Key Architectural Highlights' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Zero recurring API cost — runs entirely in WebAssembly & WebGPU' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Complete privacy — text and images stay strictly on device' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Offline capable — cached weights operate without an active internet connection' }] }],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Select any sentence or block in this editor' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Choose an action from the Writing Actions panel (e.g. Improve, Summarize, Rewrite)' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect the transformed output and replace or insert directly' }] }],
        },
      ],
    },
    {
      type: 'callout',
      attrs: { kind: 'info' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Pro Tip: ' },
            { type: 'text', text: 'Try selecting the long paragraph above and click "Shorten" or "Make Professional" to test instant local transformations.' },
          ],
        },
      ],
    },
  ],
}

export interface LabEditorProps {
  onSelectionChange?: (selectedText: string, hasSelection: boolean) => void
  onEditorReady?: (editorMethods: LabEditorMethods) => void
}

export function LabEditor({ onSelectionChange, onEditorReady }: LabEditorProps) {
  const [characterCount, setCharacterCount] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)

  const handleSelectionUpdate = useCallback((currentEditor: NonNullable<ReturnType<typeof useEditor>>) => {
    const { from, to, empty } = currentEditor.state.selection
    const selected = empty ? '' : currentEditor.state.doc.textBetween(from, to, ' ')
    onSelectionChange?.(selected, !empty && selected.trim().length > 0)

    const allText = currentEditor.state.doc.textBetween(0, currentEditor.state.doc.content.size, ' ')
    setCharacterCount(allText.length)
    setWordCount(allText.trim() ? allText.trim().split(/\s+/).length : 0)
  }, [onSelectionChange])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
      }),
      CodeBlock,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
      FixedTable.configure({ resizable: true, cellMinWidth: 96, handleWidth: 6 }),
      StyledTableCell,
      StyledTableHeader,
      TableInteraction,
      Underline,
      Callout,
      ToggleBlock,
    ],
    content: SAMPLE_LAB_DOCUMENT,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[360px] p-6 focus:outline-none text-slate-800 dark:text-slate-100 font-sans leading-relaxed',
        'aria-label': 'Lab Sample Document Content',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: ed }) => handleSelectionUpdate(ed),
    onSelectionUpdate: ({ editor: ed }) => handleSelectionUpdate(ed),
  })

  useEffect(() => {
    if (!editor) return
    editorRef.current = editor

    handleSelectionUpdate(editor)

    const methods: LabEditorMethods = {
      replaceSelection: (text: string) => {
        if (!editor) return
        const { from, to, empty } = editor.state.selection
        if (empty) {
          editor.commands.insertContent(text)
        } else {
          editor.commands.insertContentAt({ from, to }, text)
        }
      },
      insertBelowSelection: (text: string) => {
        if (!editor) return
        const { to } = editor.state.selection
        editor.commands.insertContentAt(to, `\n${text}`)
      },
      insertBlocks: (blocks: JSONContent[]) => {
        if (!editor) return
        const { to } = editor.state.selection
        editor.commands.insertContentAt(to, blocks)
      },
      getSelectedText: () => {
        if (!editor) return ''
        const { from, to, empty } = editor.state.selection
        return empty ? '' : editor.state.doc.textBetween(from, to, ' ')
      },
      getAllText: () => {
        if (!editor) return ''
        return editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')
      },
    }

    onEditorReady?.(methods)
  }, [editor, handleSelectionUpdate, onEditorReady])

  const handleResetSample = () => {
    if (editor) {
      editor.commands.setContent(SAMPLE_LAB_DOCUMENT)
    }
  }

  const handleClearEditor = () => {
    if (editor) {
      editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
    }
  }

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Editor Header / Stats */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Lab Document
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline">{wordCount} words</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{characterCount} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetSample}
            className="h-7 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Reset Sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearEditor}
            className="h-7 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Editor Content Surface */}
      <div className="relative min-h-[380px] cursor-text">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
