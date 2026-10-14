import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { DocsView } from '../types'

const PANE = 'repo-docs'
const MAX_CHARS = 90000 // one drawing holds 100000 characters of Markdown
const NOTES_ROOT = '.claude/release-notes' // under the home folder, one subfolder per package.json name
const EMPTY: DocsView = { files: [], notes: [], path: null, text: '', note: '' }
const view = atom({ plugin: 'repo-docs', key: 'view' } as const, EMPTY)

// Relative to the session's working directory, so a worktree lists its own files.
// ponytail: scans on /docs and on Refresh only; add a watcher if that is not enough.
const scan = async ($: any): Promise<string[]> => {
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const f of await $.fs.list(dir).catch(() => [])) {
      const p = `${dir}/${f.name}`
      if (f.kind === 'dir') await walk(p)
      else if (f.kind === 'file' && f.name.endsWith('.md')) out.push(p)
    }
  }
  await walk('docs')
  if (await $.fs.exists('CHANGELOG.md')) out.unshift('CHANGELOG.md')
  return out.sort((a, b) => (a === 'CHANGELOG.md' ? -1 : b === 'CHANGELOG.md' ? 1 : a.localeCompare(b)))
}

// Numeric-aware, so 1.10.0 sorts after 1.9.0.
const byVersion = (a: string, b: string): number => {
  const x = a.split(/(\d+)/)
  const y = b.split(/(\d+)/)
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] === y[i]) continue
    const n = i % 2 === 1 ? Number(x[i]) - Number(y[i]) : (x[i] ?? '') < (y[i] ?? '') ? -1 : 1
    if (n !== 0) return n
  }
  return x.length - y.length
}

// A missing or empty folder is just no group.
const scanNotes = async ($: any): Promise<string[]> => {
  const home = await $.env.get('HOME')
  const name = await packageName($)
  if (!home || !name) return []
  const dir = `${home}/${NOTES_ROOT}/${name}`
  const entries = await $.fs.list(dir).catch(() => [])
  return entries
    .filter((f: any) => f.kind === 'file' && f.name.endsWith('.md'))
    .map((f: any) => `${dir}/${f.name}`)
    .sort((a: string, b: string) => byVersion(b, a))
}

const packageName = async ($: any): Promise<string> => {
  try {
    return String(JSON.parse(await $.fs.read('package.json')).name ?? '')
  } catch {
    return ''
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'docs',
      description: 'Browse CHANGELOG.md and docs/**/*.md in a pane',
    })
    return next(e)
  })

  on('command.run', { command: 'docs' }, async $ => {
    const files = await scan($)
    const notes = await scanNotes($)
    await update($, view, () => ({ files, notes, path: null, text: '', note: '' }))
    await $.ui.open({ id: PANE, title: 'Docs' })
    return { text: `Docs pane opened: ${files.length} files, ${notes.length} release notes.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    // $.state outlives a hot reload, so a value saved by an older version may lack newer fields.
    const v: DocsView = { ...EMPTY, ...(await read($, view)) }

    const openFile = async (path: string) => {
      let text = ''
      let note = ''
      try {
        text = await $.fs.read(path)
        if (text.length > MAX_CHARS) {
          text = text.slice(0, MAX_CHARS)
          note = 'Cut at 90000 characters.'
        }
      } catch {
        note = `Cannot read ${path}.`
      }
      await update($, view, old => ({ ...old, path, text, note }))
    }
    const back = () => update($, view, old => ({ ...old, path: null, text: '', note: '' }))
    const refresh = async () => {
      const files = await scan($)
      const notes = await scanNotes($)
      await update($, view, old => ({ ...old, files, notes }))
    }

    if (v.path === null) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text dimColor>{v.files.length + v.notes.length} files. Click one to read it. </Text>
            <Button key="refresh" label="Refresh" onPress={refresh} />
          </Box>
          {v.files.length + v.notes.length === 0 && <Text dimColor>No CHANGELOG.md or docs/*.md here.</Text>}
          {v.notes.length > 0 && <Text bold>Release notes</Text>}
          {v.notes.map(path => (
            <Button key={path} label={path.split('/').pop()} onPress={() => openFile(path)} />
          ))}
          {v.files.length > 0 && <Text bold>Repo docs</Text>}
          {v.files.map(path => (
            <Button key={path} label={path} onPress={() => openFile(path)} />
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Button key="back" label="< Back" variant="primary" onPress={back} />
          <Text bold> {v.path}</Text>
        </Box>
        {v.note !== '' && <Text dimColor>{v.note}</Text>}
        <Markdown text={v.text} />
      </Box>
    )
  })
}
