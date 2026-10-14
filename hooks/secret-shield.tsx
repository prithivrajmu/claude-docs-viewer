import type { Register } from 'claude-code'

// One list: [pattern, replacement]. A `$1` keeps the key of a key=value pair and hides only its value.
const SECRETS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED private key]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED aws key]'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{40,})/g, '[REDACTED github token]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED slack token]'],
  [/\bsk-ant-[\w-]{20,}/g, '[REDACTED anthropic key]'],
  [/\bsk-(?:proj-)?[\w-]{32,}/g, '[REDACTED openai key]'],
  [/\b((?:password|passwd|secret|token|api[_-]?key)\w*["']?\s*[=:]\s*["']?)[^\s"',;]{4,}/gi, '$1[REDACTED]'],
]

// Returns the cleaned text and how many secrets it held.
export const redact = (text: string): { text: string; count: number } => {
  let count = 0
  for (const [re, to] of SECRETS) {
    text = text.replace(re, (...m) => {
      if (m[0].endsWith('[REDACTED]')) return m[0] // already hidden by an earlier pattern
      count++
      return to.replace('$1', m[1] ?? '')
    })
  }
  return { text, count }
}

export const register: Register = on => {
  // Rewrites the tool result before it is stored, so Claude only ever reads the cleaned form.
  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    let count = 0
    const content = e.message.content.map((b: any) => {
      if (b.type !== 'tool_result') return b
      const fix = (s: string) => {
        const r = redact(s)
        count += r.count
        return r.text
      }
      if (typeof b.content === 'string') return { ...b, content: fix(b.content) }
      if (Array.isArray(b.content))
        return { ...b, content: b.content.map((c: any) => (c.type === 'text' ? { ...c, text: fix(c.text) } : c)) }
      return b
    })
    if (count > 0) $.ui.toast(`shield: redacted ${count} secret${count > 1 ? 's' : ''}`)
    return next({ ...e, message: { ...e.message, content } })
  }).catch(($, e, next) => next(e)) // on failure the row is stored unchanged, never dropped
}
