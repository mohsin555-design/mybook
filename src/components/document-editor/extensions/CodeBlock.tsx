import { CopyIcon, Copy01Icon, TextWrapIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useMemo, useState, type ElementType, type MouseEvent, type PointerEvent } from 'react'

import { Button } from '../../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { CODE_LANGUAGES, detectCodeLanguage, normalizeLanguage, syntaxDecorationsForCodeBlock } from './CodeBlockLanguage'

const CodeContent = NodeViewContent as ElementType

function CodeBlockView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const language = normalizeLanguage(node.attrs.language)
  const detectedLanguage = normalizeLanguage(node.attrs.detectedLanguage)
  const effectiveLanguage = language === 'auto' ? detectedLanguage : language
  const wrap = node.attrs.wrap !== false
  const [copied, setCopied] = useState(false)
  const label = useMemo(() => CODE_LANGUAGES.find((item) => item.value === language)?.label ?? 'Auto', [language])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const keepEditorFocus = (event: MouseEvent | PointerEvent) => event.preventDefault()

  return (
    <NodeViewWrapper
      as="pre"
      className={`mybook-code-block ${wrap ? 'mybook-code-block-wrap' : 'mybook-code-block-scroll'}`}
      data-language={effectiveLanguage}
      data-selected-language={language}
    >
      <div className="mybook-code-block-toolbar" contentEditable={false}>
        <Select
          value={language}
          onValueChange={(value) => {
            updateAttributes({ language: value })
            editor.view.focus()
          }}
        >
          <SelectTrigger
            aria-label="Code language"
            size="sm"
            onMouseDown={(event) => event.stopPropagation()}
            className="mybook-code-language-trigger"
          >
            <SelectValue>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" sideOffset={6} showScrollButtons={false} className="mybook-code-language-content max-h-72 min-w-44 rounded-[8px] shadow-none">
            {CODE_LANGUAGES.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? 'Copied code' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
          onMouseDown={keepEditorFocus}
          onClick={() => {
            void navigator.clipboard?.writeText(node.textContent)
            setCopied(true)
            editor.view.focus()
          }}
          className="mybook-code-toolbar-button"
        >
          <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate code block"
          title="Duplicate code block"
          onMouseDown={keepEditorFocus}
          onClick={() => {
            const pos = getPos()
            if (pos === undefined) return
            editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
          }}
          className="mybook-code-toolbar-button"
        >
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={wrap ? 'Disable text wrapping' : 'Enable text wrapping'}
          aria-pressed={wrap}
          title={wrap ? 'Wrap text on' : 'Wrap text off'}
          onMouseDown={keepEditorFocus}
          onClick={() => {
            updateAttributes({ wrap: !wrap })
            editor.view.focus()
          }}
          className="mybook-code-toolbar-button"
        >
          <HugeiconsIcon icon={TextWrapIcon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      <CodeContent as="code" className={`language-${effectiveLanguage}`} />
    </NodeViewWrapper>
  )
}

export const CodeBlock = TiptapCodeBlock.extend({
  addOptions() {
    return {
      languageClassPrefix: 'language-',
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
      tabSize: 2,
      HTMLAttributes: {},
      ...this.parent?.(),
      defaultLanguage: 'auto',
      enableTabIndentation: true,
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'auto',
        parseHTML: (element) => normalizeLanguage(element.firstElementChild?.className.replace(/^language-/u, '') || element.getAttribute('data-selected-language') || 'auto'),
        rendered: false,
      },
      detectedLanguage: {
        default: 'text',
        parseHTML: (element) => normalizeLanguage(element.getAttribute('data-language') || 'text'),
        rendered: false,
      },
      wrap: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-wrap') !== 'false',
        rendered: false,
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []
    return [
      ...parentPlugins,
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          let transaction = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return
            const selectedLanguage = normalizeLanguage(node.attrs.language)
            if (selectedLanguage !== 'auto') return
            const detectedLanguage = detectCodeLanguage(node.textContent)
            if (normalizeLanguage(node.attrs.detectedLanguage) === detectedLanguage) return
            transaction = transaction.setNodeMarkup(pos, undefined, { ...node.attrs, detectedLanguage })
            changed = true
          })
          return changed ? transaction.setMeta('addToHistory', false) : null
        },
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== this.name) return
              const selectedLanguage = normalizeLanguage(node.attrs.language)
              const language = selectedLanguage === 'auto' ? normalizeLanguage(node.attrs.detectedLanguage) : selectedLanguage
              decorations.push(...syntaxDecorationsForCodeBlock(node.textContent, language, pos + 1))
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
