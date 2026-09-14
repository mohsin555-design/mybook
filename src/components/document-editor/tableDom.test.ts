// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { tableElementsFromNodeDom } from './tableDom'

describe('tableElementsFromNodeDom', () => {
  it('uses the inner table rather than its full-width Tiptap wrapper', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'tableWrapper'
    const table = document.createElement('table')
    wrapper.append(table)

    expect(tableElementsFromNodeDom(wrapper)).toEqual({ wrapper, table })
  })
})