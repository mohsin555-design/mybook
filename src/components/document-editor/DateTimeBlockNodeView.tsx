import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { DateTimePicker } from './DateTimePicker'

export function DateTimeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper as="div" className="mybook-date-time-block inline-flex" contentEditable={false}>
      <DateTimePicker
        value={typeof node.attrs.value === 'string' ? node.attrs.value : null}
        includeTime={node.attrs.includeTime === true}
        onChange={(value, includeTime) => updateAttributes({ value, includeTime })}
        onIncludeTimeChange={(includeTime) => updateAttributes({ includeTime })}
      />
    </NodeViewWrapper>
  )
}
