import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect } from 'react'

import { DateTimePicker } from './DateTimePicker'

export function DateTimeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  useEffect(() => {
    if (node.attrs.openPicker === true) updateAttributes({ openPicker: false })
  }, [node.attrs.openPicker, updateAttributes])

  return (
    <NodeViewWrapper as="span" className="mybook-date-time-block inline-flex align-middle" contentEditable={false} data-date-time-mention="true">
      <DateTimePicker
        value={typeof node.attrs.value === 'string' ? node.attrs.value : null}
        endDateEnabled={node.attrs.endDateEnabled === true}
        endValue={typeof node.attrs.endValue === 'string' ? node.attrs.endValue : null}
        includeTime={node.attrs.includeTime === true}
        use24Hour={node.attrs.use24Hour === true}
        dateFormat={node.attrs.dateFormat}
        autoOpen={node.attrs.openPicker === true}
        onChange={(value, includeTime) => updateAttributes({ value, includeTime })}
        onEndDateChange={(endDateEnabled, endValue) => updateAttributes({ endDateEnabled, endValue })}
        onIncludeTimeChange={(includeTime) => updateAttributes({ includeTime })}
        onTimeFormatChange={(use24Hour) => updateAttributes({ use24Hour })}
        onDateFormatChange={(dateFormat) => updateAttributes({ dateFormat })}
        onClear={() => updateAttributes({ value: null, endDateEnabled: false, endValue: null, includeTime: false })}
      />
    </NodeViewWrapper>
  )
}
