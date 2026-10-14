import { expect, test } from 'claude-code/testing'

// A fake repo: the test's `on` hooks stand for the engine's file system.
const NOTES = '/home/me/.claude/release-notes/my-app'
const WT = '.claude/worktrees/feat-x'
const fakeRepo = (on: any, name: string, notes: string[] = []) => {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name }),
    'CHANGELOG.md': '# Changes',
    'README.md': '# Readme',
    'mock.html': '<h1>mock</h1>',
    'data.json': '{}',
    'app/guide.md': '# Guide',
    'docs/adr/0001.md': '# Decision',
    'node_modules/pkg/README.md': '# skipped',
    [`${WT}/docs/wt.md`]: '# In the worktree',
    [`${WT}/node_modules/pkg/README.md`]: '# skipped',
  }
  for (const n of notes) files[`${NOTES}/${n}`] = `# Notes ${n}`
  const F = (n: string) => [n, 'file'] as [string, 'file']
  const D = (n: string) => [n, 'dir'] as [string, 'dir']
  const dirs: Record<string, [string, 'file' | 'dir'][]> = {
    '': [F('package.json'), F('CHANGELOG.md'), F('README.md'), F('mock.html'), F('data.json'), D('app'), D('docs'), D('node_modules'), D('.claude')],
    app: [F('guide.md')],
    docs: [D('adr')],
    'docs/adr': [F('0001.md')],
    node_modules: [D('pkg')],
    'node_modules/pkg': [F('README.md')],
    '.claude': [D('worktrees')],
    '.claude/worktrees': [D('feat-x'), F('stray.md')],
    [WT]: [D('docs'), D('node_modules')],
    [`${WT}/docs`]: [F('wt.md')],
    [`${WT}/node_modules`]: [D('pkg')],
    [NOTES]: notes.map(F),
  }
  // the engine may hand over an absolute path; match on the longest repo-relative tail
  const rel = (p: string) =>
    Object.keys({ ...files, ...dirs })
      .filter(k => k !== '' && (p === k || p.endsWith('/' + k)))
      .sort((a, b) => b.length - a.length)[0]
  on('fs.read', (_$: any, e: any) => {
    const text = files[rel(e.path) ?? e.path]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.exists', (_$: any, e: any) => ({ value: (rel(e.path) ?? e.path) in files }))
  on('fs.list', (_$: any, e: any) => {
    const k = rel(e.path ?? '')
    // the working directory arrives as an absolute path, which no key names
    const list = k === undefined ? (String(e.path).includes('release-notes') ? [] : dirs['']) : dirs[k]
    return { value: (list ?? []).map(([n, kind]) => ({ name: n, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('env.get', () => ({ value: '/home/me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

const mountPane = ($: any) =>
  $.ui.mount({ plugin: 'repo-docs', surface: 'terminal', component: 'Pane', props: {}, requestId: 'repo-docs' })
const keys = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)

test('lists every md, html and txt file in the repo, skipping node_modules and other types', async ($: any, on: any) => {
  fakeRepo(on, 'my-app')
  const ran = await $.command.run({ command: 'docs' })
  expect(ran.text).toContain('5 files') // CHANGELOG, README, mock.html, app/guide.md, docs/adr/0001.md
  const ui = await mountPane($)
  const k = await keys(ui)
  expect(k).toEqual(expect.arrayContaining(['CHANGELOG.md', 'README.md', 'mock.html', 'app/guide.md', 'docs/adr/0001.md']))
  expect(k).not.toContain('data.json')
  expect(k).not.toContain('node_modules/pkg/README.md')
})

test('opens an md file as Markdown, an html file as code, goes back', async ($: any, on: any) => {
  fakeRepo(on, 'my-app')
  await $.command.run({ command: 'docs' })
  const ui = await mountPane($)
  await ui.press({ key: 'app/guide.md' })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.press({ key: 'back' })
  await ui.press({ key: 'mock.html' })
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
  await ui.press({ key: 'back' })
  expect(await ui.find({ key: 'CHANGELOG.md' })).toBeDefined()
})

test('worktrees are listed collapsed, and opening one shows its own files', async ($: any, on: any) => {
  fakeRepo(on, 'my-app')
  expect((await $.command.run({ command: 'docs' })).text).toContain('1 worktrees')
  const ui = await mountPane($)
  expect(await keys(ui)).toContain('wt:feat-x')
  expect(await keys(ui)).not.toContain(`${WT}/docs/wt.md`)
  await ui.press({ key: 'wt:feat-x' })
  const k = await keys(ui)
  expect(k).toContain(`${WT}/docs/wt.md`)
  expect(k).not.toContain(`${WT}/node_modules/pkg/README.md`)
  await ui.press({ key: `${WT}/docs/wt.md` })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.press({ key: 'back' })
  expect(await keys(ui)).toContain(`${WT}/docs/wt.md`) // still open after Back
  await ui.press({ key: 'wt:feat-x' })
  expect(await keys(ui)).not.toContain(`${WT}/docs/wt.md`)
})

test('works in any repo', async ($: any, on: any) => {
  fakeRepo(on, 'other')
  expect((await $.command.run({ command: 'docs' })).text).toContain('5 files')
})

test('release notes group: newest first, click opens, back returns', async ($: any, on: any) => {
  fakeRepo(on, 'my-app', ['1.9.0.md', '1.10.0.md', 'readme.txt'])
  await $.command.run({ command: 'docs' })
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: 'Release notes' })).toBeDefined()
  expect((await keys(ui)).slice(1, 3)).toEqual([`${NOTES}/1.10.0.md`, `${NOTES}/1.9.0.md`])
  await ui.press({ key: `${NOTES}/1.10.0.md` })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.press({ key: 'back' })
  expect(await ui.find({ key: 'CHANGELOG.md' })).toBeDefined()
})

test('release notes group is hidden when the folder is missing or empty', async ($: any, on: any) => {
  fakeRepo(on, 'my-app')
  await $.command.run({ command: 'docs' })
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: 'Release notes' })).toBeUndefined()
})
