import { ClipboardDocumentIcon, DocumentDuplicateIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { useEffect, useRef, useState } from 'react'

import { Button } from '../ui/button'
import { BlockCommandMenu } from './SlashCommandMenu'
import { commandMenuTop, slashCommands, type SlashCommand } from './slashCommands'

interface BlockTarget {
  node: ProseMirrorNode
  pos: number
  rect: DOMRect
  controlRect: DOMRect
}

const CENTERED_BLOCK_CONTROLS = new Set(['bookmarkBlock', 'documentLink', 'embedBlock', 'horizontalRule'])

function targetAtBlockPos(editor: Editor, node: ProseMirrorNode, pos: number): BlockTarget {
  const { view } = editor
  const blockElement = view.nodeDOM(pos)
  const coords = view.coordsAtPos(pos)
  const rect = blockElement instanceof Element
    ? blockElement.getBoundingClientRect()
    : new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
  const $from = editor.state.doc.resolve(Math.min(pos + 1, editor.state.doc.content.size))
  const topPos = $from.depth > 0 ? $from.before(1) : pos
  const topElement = view.nodeDOM(topPos)
  const topCoords = view.coordsAtPos(topPos)
  const controlRect = topElement instanceof Element
    ? topElement.getBoundingClientRect()
    : new DOMRect(topCoords.left, topCoords.top, topCoords.right - topCoords.left, topCoords.bottom - topCoords.top)
  return { node, pos, rect, controlRect }
}

function blockTargetAtResolvedPos(editor: Editor, pos: number): BlockTarget | null {
  const { state, view } = editor
  const $from = state.doc.resolve(pos)
  let topBlock: { pos: number; rect: DOMRect } | null = null

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue
    const tablePos = $from.before(depth)
    return targetAtBlockPos(editor, node, tablePos)
  }

  if ($from.depth > 0) {
    const topPos = $from.before(1)
    const topCoords = view.coordsAtPos(topPos)
    topBlock = { pos: topPos, rect: new DOMRect(topCoords.left, topCoords.top, topCoords.right - topCoords.left, topCoords.bottom - topCoords.top) }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'taskItem') continue
    const pos = $from.before(depth)
    const coords = view.coordsAtPos(pos)
    const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    return { node, pos, rect, controlRect: topBlock?.rect ?? rect }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.isBlock) {
      const pos = $from.before(depth)
      const coords = view.coordsAtPos(pos)
      const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
      return { node, pos, rect, controlRect: topBlock?.rect ?? rect }
    }
  }
  return null
}

function findSelectionTarget(editor: Editor): BlockTarget | null {
  const { state, view } = editor
  const { selection } = state
  if (selection instanceof NodeSelection) {
    const coords = view.coordsAtPos(selection.from)
    const rect = new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    return { node: selection.node, pos: selection.from, rect, controlRect: rect }
  }
  return blockTargetAtResolvedPos(editor, selection.from)
}

function findPointerTarget(editor: Editor, event: PointerEvent): BlockTarget | null {
  const pointerElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-document-link-block="true"]') : null
  if (pointerElement) {
    let match: BlockTarget | null = null
    editor.state.doc.descendants((node, pos) => {
      if (match || node.type.name !== 'documentLink') return
      const nodeElement = editor.view.nodeDOM(pos)
      if (nodeElement === pointerElement || (nodeElement instanceof Node && nodeElement.contains(pointerElement))) {
        match = targetAtBlockPos(editor, node, pos)
      }
    })
    if (match) return match

    const domPosition = editor.view.posAtDOM(pointerElement, 0)
    const resolved = editor.state.doc.resolve(Math.min(domPosition, editor.state.doc.content.size))
    for (let depth = resolved.depth; depth > 0; depth -= 1) {
      const node = resolved.node(depth)
      if (node.type.name !== 'documentLink') continue
      return targetAtBlockPos(editor, node, resolved.before(depth))
    }
  }
  const result = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!result) return null
  return blockTargetAtResolvedPos(editor, result.pos)
}

function isInsideTable(editor: Editor, pos: number) {
  const resolved = editor.state.doc.resolve(pos)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name === 'table') return true
  }
  return false
}

function findGutterTarget(editor: Editor, event: PointerEvent): BlockTarget | null {
  const candidates: BlockTarget[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return
    if (isInsideTable(editor, pos) && node.type.name !== 'table') return
    if (['tableRow', 'tableCell', 'tableHeader'].includes(node.type.name)) return
    const target = targetAtBlockPos(editor, node, pos)
    const gutterLeft = target.controlRect.left - 96
    const gutterRight = target.controlRect.left + 4
    const isInRow = event.clientY >= target.rect.top - 8 && event.clientY <= target.rect.bottom + 8
    const isInGutter = event.clientX >= gutterLeft && event.clientX <= gutterRight
    if (isInRow && isInGutter) candidates.push(target)
  })
  return candidates.sort((a, b) => a.node.nodeSize - b.node.nodeSize)[0] ?? null
}

function collectGutterTargets(editor: Editor): BlockTarget[] {
  const targets: BlockTarget[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return
    if (isInsideTable(editor, pos) && node.type.name !== 'table') return
    if (['tableRow', 'tableCell', 'tableHeader'].includes(node.type.name)) return
    const target = targetAtBlockPos(editor, node, pos)
    if (target.rect.width > 0 && target.rect.height > 0) targets.push(target)
  })
  return targets
}

function selectTarget(editor: Editor, target: BlockTarget) {
  const selection = target.node.isTextblock
    ? TextSelection.create(editor.state.doc, target.pos + 1, Math.max(target.pos + 1, target.pos + target.node.nodeSize - 1))
    : NodeSelection.create(editor.state.doc, target.pos)
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
  editor.view.focus()
}

function duplicateTarget(editor: Editor, target: BlockTarget) {
  editor.chain().focus().insertContentAt(target.pos + target.node.nodeSize, target.node.toJSON()).run()
}

async function copyTarget(target: BlockTarget) {
  const text = target.node.textContent.trim()
  const clipboardText = text || JSON.stringify(target.node.toJSON())
  await navigator.clipboard?.writeText(clipboardText)
}

function deleteTarget(editor: Editor, target: BlockTarget) {
  editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize }).run()
  editor.view.dom.blur()
}

function blockControlsTop(target: BlockTarget | null) {
  if (!target) return 8
  if (CENTERED_BLOCK_CONTROLS.has(target.node.type.name)) return Math.max(8, target.rect.top + target.rect.height / 2 - 14)
  return Math.max(8, target.rect.top)
}

function moveTarget(editor: Editor, source: BlockTarget, drop: { pos: number; side: 'before' | 'after' }) {
  const targetInsertPos = drop.side === 'before' ? drop.pos : drop.pos + editor.state.doc.nodeAt(drop.pos)!.nodeSize
  if (targetInsertPos >= source.pos && targetInsertPos <= source.pos + source.node.nodeSize) return
  const insertPos = targetInsertPos > source.pos ? targetInsertPos - source.node.nodeSize : targetInsertPos
  const tr = editor.state.tr.delete(source.pos, source.pos + source.node.nodeSize).insert(insertPos, source.node)
  editor.view.dispatch(tr.scrollIntoView())
  const selection = source.node.isTextblock && source.node.content.size
    ? TextSelection.create(editor.state.doc, insertPos + 1)
    : NodeSelection.create(editor.state.doc, insertPos)
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  editor.view.focus()
}

function GripHandleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="5" cy="3.5" r="1.25" />
      <circle cx="11" cy="3.5" r="1.25" />
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="11" cy="8" r="1.25" />
      <circle cx="5" cy="12.5" r="1.25" />
      <circle cx="11" cy="12.5" r="1.25" />
    </svg>
  )
}

export function EditorBlockControls({ editor, onInsertBlock }: { editor: Editor; onInsertBlock: (commandId: string) => void }) {
  const [target, setTarget] = useState<BlockTarget | null>(null)
  const [gutterTargets, setGutterTargets] = useState<BlockTarget[]>([])
  const [isInsertOpen, setIsInsertOpen] = useState(false)
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [selectedInsertIndex, setSelectedInsertIndex] = useState(0)
  const [dragState, setDragState] = useState<{
    source: BlockTarget
    startX: number
    startY: number
    isDragging: boolean
    drop: { pos: number; side: 'before' | 'after'; rect: DOMRect } | null
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hoverBridgeRef = useRef<HTMLDivElement>(null)
  const insertMenuRef = useRef<HTMLDivElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    const editorElement = editor.view.dom
    const updateGutterTargets = () => setGutterTargets(collectGutterTargets(editor))
    const updateOnResize = () => {
      updateGutterTargets()
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) setTarget(findSelectionTarget(editor))
    }
    const closeOnScroll = (event: Event) => {
      if (!isInsertOpen && !isActionsOpen) return
      const scrollTarget = event.target as Node | null
      if (scrollTarget && (insertMenuRef.current?.contains(scrollTarget) || actionsMenuRef.current?.contains(scrollTarget))) return
      setIsInsertOpen(false)
      setIsActionsOpen(false)
    }
    const updateFromPointer = (event: PointerEvent) => {
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
      const pointerNode = event.target as Node | null
      if (
        pointerNode &&
        (rootRef.current?.contains(pointerNode) ||
          hoverBridgeRef.current?.contains(pointerNode) ||
          insertMenuRef.current?.contains(pointerNode) ||
          actionsMenuRef.current?.contains(pointerNode))
      ) return
      setTarget(findPointerTarget(editor, event) ?? findGutterTarget(editor, event))
    }
    const hideFromPointerLeave = (event: PointerEvent) => {
      if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
      const related = event.relatedTarget
      if (related instanceof Node && (rootRef.current?.contains(related) || hoverBridgeRef.current?.contains(related))) return
      setTarget(null)
    }
    const selectFromDoubleClick = (event: MouseEvent) => {
      const point = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (point && isInsideTable(editor, point.pos)) return
      const nextTarget = findPointerTarget(editor, event as PointerEvent)
      if (!nextTarget) return
      event.preventDefault()
      setTarget(nextTarget)
      selectTarget(editor, nextTarget)
    }
    updateGutterTargets()
    editor.on('transaction', updateGutterTargets)
    document.addEventListener('pointermove', updateFromPointer)
    editorElement.addEventListener('pointerleave', hideFromPointerLeave)
    editorElement.addEventListener('dblclick', selectFromDoubleClick)
    window.addEventListener('resize', updateOnResize)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('pointermove', updateFromPointer)
      editorElement.removeEventListener('pointerleave', hideFromPointerLeave)
      editorElement.removeEventListener('dblclick', selectFromDoubleClick)
      editor.off('transaction', updateGutterTargets)
      window.removeEventListener('resize', updateOnResize)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [dragState?.isDragging, editor, isActionsOpen, isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen && !isActionsOpen) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (rootRef.current?.contains(node) || insertMenuRef.current?.contains(node) || actionsMenuRef.current?.contains(node)) return
      setIsInsertOpen(false)
      setIsActionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown)
  }, [isActionsOpen, isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen) return
    setSelectedInsertIndex(0)
  }, [isInsertOpen])

  useEffect(() => {
    if (!isInsertOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsInsertOpen(false)
        editor.view.focus()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedInsertIndex((index) => (index + 1) % slashCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedInsertIndex((index) => (index - 1 + slashCommands.length) % slashCommands.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const command = slashCommands[selectedInsertIndex]
        if (command) {
          onInsertBlock(command.id)
          setIsInsertOpen(false)
          editor.view.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [editor, isInsertOpen, onInsertBlock, selectedInsertIndex])

  useEffect(() => {
    if (!dragState) return
    const handlePointerMove = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      const nextTarget = findPointerTarget(editor, event)
      const drop = nextTarget && nextTarget.pos !== dragState.source.pos
        ? {
            pos: nextTarget.pos,
            side: event.clientY < nextTarget.rect.top + nextTarget.rect.height / 2 ? 'before' as const : 'after' as const,
            rect: nextTarget.rect,
          }
        : dragState.drop
      setDragState({ ...dragState, isDragging: dragState.isDragging || distance > 4, drop })
    }
    const handlePointerUp = () => {
      if (dragState.isDragging) {
        suppressNextClickRef.current = true
        window.setTimeout(() => { suppressNextClickRef.current = false }, 0)
        if (dragState.drop) moveTarget(editor, dragState.source, dragState.drop)
      }
      setDragState(null)
    }
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, editor])

  const top = blockControlsTop(target)
  const left = Math.max(8, (target?.controlRect.left ?? 76) - 68)
  const header = document.querySelector<HTMLElement>('.mybook-document-editor > header')
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const menuBoundary = Math.max(8, headerBottom + 8)
  const controlsTop = Math.max(top, menuBoundary)
  const bridgeTop = Math.max(8, Math.min(controlsTop, target?.rect.top ?? controlsTop))
  const bridgeLeft = Math.max(0, left)
  const bridgeWidth = Math.max(0, (target?.controlRect.left ?? left) - bridgeLeft)
  const bridgeHeight = Math.max(32, target?.rect.height ?? 32)
  const menuRect = new DOMRect(left, controlsTop, 56, 28)
  const insertMenuTop = commandMenuTop(menuRect, 352, 8, menuBoundary)
  const actionsMenuTop = commandMenuTop(menuRect, 128, 8, menuBoundary)
  const actionsMenuWidth = 176
  const gripLeft = left + 32
  const gripRight = left + 60
  const rightAlignedActionsLeft = gripRight - actionsMenuWidth
  const flippedActionsLeft = gripLeft
  const actionsMenuLeft = Math.max(8, rightAlignedActionsLeft >= 8
    ? Math.min(rightAlignedActionsLeft, window.innerWidth - actionsMenuWidth - 8)
    : Math.min(flippedActionsLeft, window.innerWidth - actionsMenuWidth - 8))
  const isDragging = Boolean(dragState?.isDragging)

  const runInsertCommand = (command: SlashCommand) => {
    onInsertBlock(command.id)
    setIsInsertOpen(false)
    editor.view.focus()
  }

  return (
    <>
      {gutterTargets.map((gutterTarget) => (
        <div
          key={`${gutterTarget.pos}-${gutterTarget.node.type.name}`}
          className="mybook-editor-block-gutter fixed z-10 bg-transparent"
          style={{
            top: Math.max(8, gutterTarget.rect.top - 8),
            left: Math.max(0, gutterTarget.controlRect.left - 96),
            width: 100,
            height: Math.max(32, gutterTarget.rect.height + 16),
          }}
          aria-hidden="true"
          onPointerEnter={() => setTarget(gutterTarget)}
          onPointerMove={() => setTarget(gutterTarget)}
          onPointerLeave={(event) => {
            if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
            const related = event.relatedTarget
            if (related instanceof Node && (editor.view.dom.contains(related) || rootRef.current?.contains(related) || hoverBridgeRef.current?.contains(related))) return
            setTarget(null)
          }}
        />
      ))}
      {target ? (
        <>
      <div
        ref={hoverBridgeRef}
        className="mybook-editor-block-hover-bridge fixed z-10 bg-transparent"
        style={{ top: bridgeTop, left: bridgeLeft, width: bridgeWidth, height: bridgeHeight }}
        aria-hidden="true"
        onPointerEnter={() => setTarget(target)}
        onPointerLeave={(event) => {
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (related instanceof Node && (editor.view.dom.contains(related) || rootRef.current?.contains(related))) return
          setTarget(null)
        }}
      />
      <div
        ref={rootRef}
        className={`mybook-editor-block-controls fixed z-20 flex items-center gap-1 ${isDragging ? 'opacity-70' : ''}`}
        style={{ top: controlsTop, left }}
        aria-label="Block controls"
        onPointerLeave={(event) => {
          if (isInsertOpen || isActionsOpen || dragState?.isDragging) return
          const related = event.relatedTarget
          if (related instanceof Node && (editor.view.dom.contains(related) || hoverBridgeRef.current?.contains(related))) return
          setTarget(null)
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Add block"
          title="Add block"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            selectTarget(editor, target)
            setIsInsertOpen((open) => !open)
            setIsActionsOpen(false)
          }}
          className="flex size-7 items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open block actions"
          title="Open block actions"
          onPointerDown={(event) => {
            event.preventDefault()
            selectTarget(editor, target)
            setDragState({ source: target, startX: event.clientX, startY: event.clientY, isDragging: false, drop: null })
          }}
          onClick={() => {
            if (suppressNextClickRef.current) return
            if (isDragging) return
            setIsActionsOpen((open) => !open)
            setIsInsertOpen(false)
          }}
          className="flex size-7 cursor-grab items-center justify-center rounded-[7px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <GripHandleIcon className="size-4" />
        </Button>
      </div>

      {isInsertOpen ? (
        <div ref={insertMenuRef} className="fixed z-20 max-h-[min(22rem,calc(100dvh-1rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]" style={{ top: insertMenuTop, left: Math.max(8, left) }} data-command-menu-scroller="true">
          <BlockCommandMenu ariaLabel="Insert block options" commands={slashCommands} selectedIndex={selectedInsertIndex} onSelectIndex={setSelectedInsertIndex} onRun={runInsertCommand} />
        </div>
      ) : null}

      {isActionsOpen ? (
        <div ref={actionsMenuRef} className="fixed z-20 w-44 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.14)]" style={{ top: actionsMenuTop, left: actionsMenuLeft }} role="menu" aria-label="Block actions">
          <button type="button" role="menuitem" onClick={() => { void copyTarget(target); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><ClipboardDocumentIcon aria-hidden="true" className="size-4" />Copy</button>
          <button type="button" role="menuitem" onClick={() => { duplicateTarget(editor, target); setIsActionsOpen(false) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm hover:bg-[var(--app-subtle)]"><DocumentDuplicateIcon aria-hidden="true" className="size-4" />Duplicate</button>
          <button type="button" role="menuitem" onClick={() => { deleteTarget(editor, target); setIsActionsOpen(false); setTarget(null); setDragState(null) }} className="flex min-h-10 w-full items-center gap-2 rounded-[7px] px-3 text-left text-sm text-red-600 hover:bg-red-50"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />Delete</button>
        </div>
      ) : null}
      {dragState?.isDragging && dragState.drop ? (
        <div
          className="pointer-events-none fixed z-20 h-0.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{
            left: Math.max(8, dragState.drop.rect.left),
            top: dragState.drop.side === 'before' ? dragState.drop.rect.top : dragState.drop.rect.bottom,
            width: Math.max(48, dragState.drop.rect.width),
          }}
        />
      ) : null}
        </>
      ) : null}
    </>
  )
}
