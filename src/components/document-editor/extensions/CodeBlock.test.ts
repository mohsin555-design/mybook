import { describe, expect, it } from 'vitest'

import { detectCodeLanguage } from './CodeBlockLanguage'

describe('detectCodeLanguage', () => {
  it.each([
    ['javascript', 'const value = 1\nconsole.log(value)'],
    ['python', 'def greet(name):\n    print(name)'],
    ['html', '<main><h1>Hello</h1></main>'],
    ['css', '.title {\n  color: red;\n}'],
    ['json', '{ "name": "MyBook", "enabled": true }'],
  ])('detects %s snippets', (language, code) => {
    expect(detectCodeLanguage(code)).toBe(language)
  })

  it('falls back to plain text when detection is uncertain', () => {
    expect(detectCodeLanguage('just a short note')).toBe('text')
  })
})
