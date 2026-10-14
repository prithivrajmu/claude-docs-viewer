import type { Register } from 'claude-code'

const ASK_TIMEOUT_MS = 60_000
const MAX_TARGETS = 5
const MAX_ENTRIES = 5

// Pure: the name of the destructive thing the command does, or null.
// ponytail: regex over the raw string; a quoted or aliased command can slip past. Add a shell parser if that matters.
export const destructive = (cmd: string): string | null => {
  const rules: [string, RegExp][] = [
    ['rm -r', /\brm\s+(?:-\w+\s+)*(?:-\w*[rR]\w*|--recursive)\b/],
    ['git reset --hard', /\bgit\s+reset\b[^;&|]*--hard\b/],
    ['git push --force', /\bgit\s+push\b[^;&|]*\s(?:--force(?![-\w])|-\w*f\w*(?=\s|$))/],
    ['git clean -f', /\bgit\s+clean\b[^;&|]*\s-\w*f/],
    ['DROP TABLE', /\bdrop\s+table\b/i],
    ['kubectl delete', /\bkubectl\s+delete\b/],
  ]
  return rules.find(([, re]) => re.test(cmd))?.[0] ?? null
}

// Paths after the first `rm` (flags dropped), up to the next ; & |.
const rmTargets = (cmd: string): string[] =>
  (cmd.match(/\brm\s+([^;&|]*)/)?.[1] ?? '')
    .split(/\s+/)
    .filter(t => t && !t.startsWith('-'))
    .slice(0, MAX_TARGETS)

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const what = destructive(e.command)
    if (!what) return next(e)

    let hit = ''
    if (what === 'rm -r') {
      const lines: string[] = []
      for (const t of rmTargets(e.command)) {
        const list = await $.fs.list(t).catch(() => null) // null: a file, a glob or missing
        lines.push(list ? `${t}/ (${list.length} entries: ${list.slice(0, MAX_ENTRIES).map(f => f.name).join(', ')}${list.length > MAX_ENTRIES ? ', ...' : ''})` : t)
      }
      hit = lines.length ? `\nHits: ${lines.join('; ')}` : ''
    }

    const q = `Destructive command (${what}): ${e.command.slice(0, 300)}${hit}\nRun it? Auto-cancels in 60 s. Allow?`
    const answer = await Promise.race([
      $.ui.ask(q, ['Allow', 'Cancel']).catch(() => 'Cancel'),
      $.clock.sleep(ASK_TIMEOUT_MS).then(() => 'timeout', () => 'Cancel'),
    ])
    return answer === 'Allow' ? next(e) : { deny: `${$.plugin.name}: ${what} ${answer === 'timeout' ? 'timed out waiting for confirmation' : 'cancelled'}.` }
  }).catch(($, e, next) =>
    // Fail closed, but only for what the matcher flags.
    destructive(e.command) ? { deny: `${$.plugin.name}: could not confirm ${destructive(e.command)}.` } : next(e),
  )
}
