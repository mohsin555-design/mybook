import { Decoration } from '@tiptap/pm/view'

export const CODE_LANGUAGES = [
  { value: 'auto', label: 'Auto' },
  { value: 'text', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Shell / Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
] as const

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  cs: 'csharp',
  'c++': 'cpp',
}

const PLAIN_LANGUAGES = new Set(['auto', 'text', 'plain', 'plaintext'])
const JS_LIKE = new Set(['javascript', 'typescript', 'jsx', 'tsx'])
const C_LIKE = new Set(['java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'kotlin'])

export function normalizeLanguage(language: unknown) {
  const value = String(language ?? 'auto').toLowerCase()
  return LANGUAGE_ALIASES[value] ?? value
}

export function detectCodeLanguage(code: string) {
  const text = code.trim()
  if (!text) return 'text'

  if (/^<(!doctype|html|head|body|[a-z][\w:-]*)(\s|>|\/>)/iu.test(text) && /<\/[a-z][\w:-]*>/iu.test(text)) return 'html'
  if (/^<\?xml\b/iu.test(text) || (/^<[\w:-]+[\s>]/u.test(text) && /<\/[\w:-]+>\s*$/u.test(text))) return 'xml'
  try {
    JSON.parse(text)
    if (/^[{[]/u.test(text)) return 'json'
  } catch {
    // Keep looking.
  }
  if (/^\s*[{[][\s\S]*[}\]]\s*$/u.test(text) && /"[^"]+"\s*:/u.test(text)) return 'json'
  if (/(^|\n)\s*(from\s+\w[\w.]*\s+import\s+|import\s+\w|def\s+\w+\(|class\s+\w+\(|print\(|if\s+__name__\s*==)/u.test(text)) return 'python'
  if (/(^|\n)\s*(const|let|var|function|export|import)\s+[\w{*]|\bconsole\.log\(|=>/u.test(text)) {
    if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean|unknown|Record<)|<[A-Z][\w.]*\s*\/?>/u.test(text)) return text.includes('<') ? 'tsx' : 'typescript'
    if (/<[A-Z][\w.]*[\s>][\s\S]*<\/[A-Z][\w.]*>|<[a-z][\w-]*[\s>][\s\S]*<\/[a-z][\w-]*>/u.test(text)) return 'jsx'
    return 'javascript'
  }
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+[\s\S]+\b(FROM|TABLE|WHERE|VALUES|SET)\b/iu.test(text)) return 'sql'
  if (/(^|\n)\s*(@mixin|@include|\$[\w-]+:|%[\w-]+|&[:.#[\s])/u.test(text)) return 'scss'
  if (/(^|\n)\s*([.#]?[\w-]+(?:\s+[.#]?[\w-]+)*|:[\w-]+)\s*\{[\s\S]*\b[\w-]+\s*:/u.test(text)) return 'css'
  if (/^#!.*\b(bash|sh|zsh)\b/u.test(text) || /(^|\n)\s*(npm|pnpm|yarn|git|cd|mkdir|echo|export)\s+/u.test(text)) return 'bash'
  if (/(^|\n)\s*[\w.-]+:\s+.+(\n\s+[\w.-]+:\s+.+)+/u.test(text)) return 'yaml'
  if (/^#{1,6}\s+\S|(^|\n)\s*[-*]\s+\S|```/u.test(text)) return 'markdown'
  if (/\bpackage\s+main\b|\bfunc\s+\w+\(/u.test(text)) return 'go'
  if (/\bfn\s+\w+\(|\blet\s+mut\b|\bimpl\s+\w+/u.test(text)) return 'rust'
  if (/<\?php|\bfunction\s+\w+\([^)]*\)\s*\{[\s\S]*\$/u.test(text)) return 'php'
  if (/\bpublic\s+class\s+\w+|\bSystem\.out\.println\(/u.test(text)) return 'java'
  if (/#include\s*<|\bint\s+main\s*\(/u.test(text)) return text.includes('std::') || text.includes('using namespace') ? 'cpp' : 'c'
  if (/\busing\s+System;|\bnamespace\s+\w+|\bConsole\.WriteLine\(/u.test(text)) return 'csharp'
  if (/\bclass\s+\w+\s*<|fun\s+main\(|val\s+\w+\s*=/u.test(text)) return 'kotlin'
  if (/\bimport\s+SwiftUI|\bstruct\s+\w+:\s+View|\blet\s+\w+\s*=/u.test(text)) return 'swift'
  if (/\bputs\s+['"]|\bdef\s+\w+\b[\s\S]*\bend\b/u.test(text)) return 'ruby'

  return 'text'
}

function tokenPatterns(language: string) {
  if (PLAIN_LANGUAGES.has(language)) return []
  const common = [
    { className: 'mybook-code-token-string', pattern: /(["'`])(?:\\.|(?!\1)[^\\])*\1/g },
    { className: 'mybook-code-token-comment', pattern: /\/\/.*|\/\*[\s\S]*?\*\/|#.*$/gm },
    { className: 'mybook-code-token-number', pattern: /\b\d+(?:\.\d+)?\b/g },
  ]
  if (language === 'html' || language === 'xml') return [
    { className: 'mybook-code-token-comment', pattern: /<!--[\s\S]*?-->/g },
    { className: 'mybook-code-token-keyword', pattern: /<\/?[\w:-]+/g },
    { className: 'mybook-code-token-attribute', pattern: /\s[\w:-]+(?==)/g },
    { className: 'mybook-code-token-string', pattern: /(["'])(?:\\.|(?!\1)[^\\])*\1/g },
  ]
  if (language === 'css' || language === 'scss') return [
    { className: 'mybook-code-token-comment', pattern: /\/\*[\s\S]*?\*\//g },
    { className: 'mybook-code-token-keyword', pattern: /(^|[{};])\s*[-\w]+\s*:/gm },
    { className: 'mybook-code-token-attribute', pattern: /[.#][\w-]+|@\w+|\$[\w-]+/g },
    { className: 'mybook-code-token-string', pattern: /(["'])(?:\\.|(?!\1)[^\\])*\1/g },
    { className: 'mybook-code-token-number', pattern: /\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)?\b/g },
  ]
  if (language === 'json' || language === 'yaml') return [
    { className: 'mybook-code-token-string', pattern: /(["'])(?:\\.|(?!\1)[^\\])*\1/g },
    { className: 'mybook-code-token-keyword', pattern: /\b(true|false|null)\b/g },
    { className: 'mybook-code-token-number', pattern: /\b-?\d+(?:\.\d+)?\b/g },
  ]
  const keywords = JS_LIKE.has(language)
    ? 'async|await|break|case|catch|class|const|continue|default|else|export|extends|finally|for|from|function|if|import|in|interface|let|new|return|switch|throw|try|type|var|while'
    : language === 'python'
      ? 'and|as|async|await|break|class|continue|def|elif|else|except|False|finally|for|from|if|import|in|is|lambda|None|not|or|pass|raise|return|True|try|while|with|yield'
      : C_LIKE.has(language)
        ? 'break|case|class|const|continue|default|defer|else|enum|for|func|fun|if|import|let|mut|namespace|new|null|package|private|public|return|static|struct|switch|using|val|var|void|while'
        : language === 'sql'
          ? 'ALTER|AND|CREATE|DELETE|DROP|FROM|GROUP|INSERT|INTO|JOIN|ORDER|SELECT|SET|TABLE|UPDATE|VALUES|WHERE'
          : language === 'bash'
            ? 'case|do|done|elif|else|esac|export|fi|for|function|if|in|then|while'
            : ''
  return keywords ? [{ className: 'mybook-code-token-keyword', pattern: new RegExp(`\\b(${keywords})\\b`, 'g') }, ...common] : common
}

export function syntaxDecorationsForCodeBlock(code: string, language: string, start: number) {
  const decorations: Decoration[] = []
  for (const { className, pattern } of tokenPatterns(language)) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code))) {
      const token = match[0]
      if (!token) continue
      decorations.push(Decoration.inline(start + match.index, start + match.index + token.length, { class: className }))
    }
  }
  return decorations
}
