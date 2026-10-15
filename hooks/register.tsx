import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { DocsView } from '../types'
import { register as secretShield } from './secret-shield'
import { register as turnReceipt, startReceipt } from './turn-receipt'
import { register as blastRadius } from './blast-radius'
import { register as park, startPark } from './park'
import { register as codePet, startPet } from './code-pet'
import { register as spinnerPacks, startSpinners } from './spinner-packs'
import { register as burn, startBurn } from './burn-meter'

const PANE = 'repo-docs'
const WORKTREES = '.claude/worktrees'
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage'])
const DOC = /\.(md|mdx|markdown)$/i // drawn as Markdown
const WANTED = /\.(md|mdx|markdown|html?|txt)$/i // the rest is drawn as code
const MAX_CHARS = 90000 // one drawing holds 100000 characters of Markdown
const NOTES_ROOT = '.claude/release-notes' // under the home folder, one subfolder per package.json name
const EMPTY: DocsView = { files: [], notes: [], worktrees: [], openWt: '', wtFiles: [], path: null, text: '', note: '' }
const view = atom({ plugin: 'repo-docs', key: 'view' } as const, EMPTY)

// Paths are relative to the session's working directory, so a worktree session lists its own files.
// `root` is '' for the working directory or a worktree's folder under it.
// ponytail: scans on /docs and on Refresh only; add a watcher if that is not enough.
const scan = async ($: any, root = ''): Promise<string[]> => {
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const f of await $.fs.list(dir || undefined).catch(() => [])) {
      const p = dir ? `${dir}/${f.name}` : f.name
      if (f.kind === 'dir') {
        if (!SKIP.has(f.name) && p !== WORKTREES) await walk(p)
      } else if (f.kind === 'file' && WANTED.test(f.name)) out.push(p)
    }
  }
  await walk(root)
  const first = root ? `${root}/CHANGELOG.md` : 'CHANGELOG.md'
  return out.sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)))
}

// Worktree folder names only; each one is scanned when opened.
const scanWorktrees = async ($: any): Promise<string[]> =>
  (await $.fs.list(WORKTREES).catch(() => []))
    .filter((f: any) => f.kind === 'dir')
    .map((f: any) => f.name as string)
    .sort((a: string, b: string) => a.localeCompare(b))

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

const loadDoc = async ($: any, path: string) => {
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

// Doc paths a reply mentions become links that open in the pane. Only files that exist are linked.
const LINK = 'file:///__docs__/'
const MENTION = /(?<![\w/.\]()-])((?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.(?:md|mdx|markdown|html?|txt))(?![\w/\]()-])/g
const linkDocs = async ($: any, text: string) => {
  const found = [...new Set([...text.matchAll(MENTION)].map(m => m[1]))].slice(0, 20)
  const real = (await Promise.all(found.map(p => $.fs.exists(p).then((ok: boolean) => (ok ? p : ''), () => '')))).filter(Boolean)
  if (!real.length) return { text, paths: [] as string[] }
  const hit = new Set(real)
  return { text: text.replace(MENTION, (m: string, p: string) => (hit.has(p) ? `[${m}](${LINK}${encodeURI(p)})` : m)), paths: real }
}

const docs: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'docs',
      description: 'Browse Markdown files (and .html/.txt) in the repo and its worktrees in a pane',
    })
    await startReceipt($)
    await startPark($)
    await startPet($)
    await startSpinners($)
    await startBurn($)
    return next(e)
  })

  on('command.run', { command: 'docs' }, async $ => {
    const files = await scan($)
    const notes = await scanNotes($)
    const worktrees = await scanWorktrees($)
    await update($, view, () => ({ ...EMPTY, files, notes, worktrees }))
    await $.ui.open({ id: PANE, title: 'Docs' })
    return { text: `Docs pane opened: ${files.length} files, ${notes.length} release notes, ${worktrees.length} worktrees.` }
  }).catch(() => ({ text: 'Docs pane could not open.' }))

  // Click a doc a reply mentions to read it in the pane.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const { text, paths } = await linkDocs($, e.props.text)
    if (!paths.length) return next(e)
    const { Box, Text, Markdown } = $.ui.resolve(e)
    return (
      <Box>
        {e.props.isFirstOfReply && <Text>● </Text>}
        <Markdown
          key="reply"
          text={text}
          onLinkPress={async link => {
            await loadDoc($, decodeURI(link.href.slice(LINK.length)))
            await $.ui.open({ id: PANE, title: 'Docs' })
          }}
          pressableLinks={paths.map(p => `${LINK}${encodeURI(p)}`)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown, Code } = $.ui.resolve(e)
    // $.state outlives a hot reload, so a value saved by an older version may lack newer fields.
    const v: DocsView = { ...EMPTY, ...(await read($, view)) }

    const openFile = (path: string) => loadDoc($, path)
    const back = () => update($, view, old => ({ ...old, path: null, text: '', note: '' }))
    const wtPrefix = `${WORKTREES}/${v.openWt}/`
    const refresh = async () => {
      const files = await scan($)
      const notes = await scanNotes($)
      const worktrees = await scanWorktrees($)
      const openWt = worktrees.includes(v.openWt) ? v.openWt : ''
      const wtFiles = openWt ? await scan($, `${WORKTREES}/${openWt}`) : []
      await update($, view, old => ({ ...old, files, notes, worktrees, openWt, wtFiles }))
    }
    const toggle = async (name: string) => {
      if (v.openWt === name) return update($, view, old => ({ ...old, openWt: '', wtFiles: [] }))
      await update($, view, old => ({ ...old, openWt: name, wtFiles: [] }))
      const wtFiles = await scan($, `${WORKTREES}/${name}`)
      await update($, view, old => (old.openWt === name ? { ...old, wtFiles } : old))
    }

    if (v.path === null) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text dimColor>{v.files.length + v.notes.length} files. Click one to read it. </Text>
            <Button key="refresh" label="Refresh" onPress={refresh} />
          </Box>
          {v.files.length + v.notes.length === 0 && <Text dimColor>No Markdown files here.</Text>}
          {v.notes.length > 0 && <Text bold>Release notes</Text>}
          {v.notes.map(path => (
            <Button key={path} label={path.split('/').pop()} onPress={() => openFile(path)} />
          ))}
          {v.files.length > 0 && <Text bold>Repo docs</Text>}
          {v.files.map(path => (
            <Button key={path} label={path} onPress={() => openFile(path)} />
          ))}
          {v.worktrees.length > 0 && <Text bold>Worktrees ({v.worktrees.length})</Text>}
          {v.worktrees.flatMap(name => [
            <Button key={`wt:${name}`} label={`${v.openWt === name ? 'v' : '>'} ${name}`} onPress={() => toggle(name)} />,
            ...(v.openWt === name
              ? v.wtFiles.length === 0
                ? [<Text key={`wt-empty:${name}`} dimColor>  No docs found (or still scanning).</Text>]
                : v.wtFiles.map(path => (
                    <Button key={path} label={`  ${path.slice(wtPrefix.length)}`} onPress={() => openFile(path)} />
                  ))
              : []),
          ])}
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
        {DOC.test(v.path) ? <Markdown text={v.text} /> : <Code source={v.text} path={v.path} />}
      </Box>
    )
  })
}

// The engine takes one hooks module per plugin, so each mod is a file of its own, registered here.
// secret-shield comes right after /docs so it is in place before any mod that reads tool output.
export const register: Register = (on, options) => {
  docs(on, options)
  secretShield(on, options)
  turnReceipt(on, options)
  blastRadius(on, options)
  park(on, options)
  codePet(on, options)
  spinnerPacks(on, options)
  burn(on, options)
}
