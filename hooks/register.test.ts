import { expect, test } from 'claude-code/testing'

// A fake repo: the test's `on` hooks stand for the engine's file system.
const NOTES = '/home/me/.claude/release-notes/my-app'
const fakeRepo = (on: any, name: string, notes: string[] = []) => {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name }),
    'CHANGELOG.md': '# Changes',
    'docs/adr/0001.md': '# Decision',
    'docs/notes.txt': 'not markdown',
  }
  for (const n of notes) files[`${NOTES}/${n}`] = `# Notes ${n}`
  const dirs: Record<string, [string, 'file' | 'dir'][]> = {
    docs: [['adr', 'dir'], ['notes.txt', 'file']],
    'docs/adr': [['0001.md', 'file']],
    [NOTES]: notes.map(n => [n, 'file'] as [string, 'file']),
  }
  // the engine may hand over an absolute path; match on the repo-relative tail
  const rel = (p: string) => Object.keys({ ...files, ...dirs }).find(k => p === k || p.endsWith('/' + k)) ?? p
  on('fs.read', (_$: any, e: any) => {
    const text = files[rel(e.path)]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.exists', (_$: any, e: any) => ({ value: rel(e.path) in files }))
  on('fs.list', (_$: any, e: any) => ({
    value: (dirs[rel(e.path)] ?? []).map(([n, kind]) => ({ name: n, kind, size: 0, mtimeMs: 0, isLink: false })),
  }))
  on('env.get', () => ({ value: '/home/me' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

test('lists docs, opens one as Markdown, goes back', async ($: any, on: any) => {
  fakeRepo(on, 'my-app')
  const ran = await $.command.run({ command: 'docs' })
  expect(ran.text).toContain('2 files')

  const ui = await $.ui.mount({
    plugin: 'repo-docs', surface: 'terminal', component: 'Pane', props: {}, requestId: 'repo-docs',
  })
  expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.key)).toEqual(
    expect.arrayContaining(['CHANGELOG.md', 'docs/adr/0001.md']),
  )
  await ui.press({ key: 'docs/adr/0001.md' })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.press({ key: 'back' })
  expect(await ui.find({ key: 'CHANGELOG.md' })).toBeDefined()
})

test('works in any repo, with no release notes group when the folder is missing', async ($: any, on: any) => {
  fakeRepo(on, 'other')
  expect((await $.command.run({ command: 'docs' })).text).toContain('2 files')
})

const mountPane = ($: any) =>
  $.ui.mount({ plugin: 'repo-docs', surface: 'terminal', component: 'Pane', props: {}, requestId: 'repo-docs' })

test('release notes group: newest first, click opens, back returns', async ($: any, on: any) => {
  fakeRepo(on, 'my-app', ['1.9.0.md', '1.10.0.md', 'readme.txt'])
  await $.command.run({ command: 'docs' })
  const ui = await mountPane($)
  expect(await ui.find({ type: 'Text', text: 'Release notes' })).toBeDefined()
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
  expect(keys.slice(1, 3)).toEqual([`${NOTES}/1.10.0.md`, `${NOTES}/1.9.0.md`])
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
  expect(await ui.find({ key: 'CHANGELOG.md' })).toBeDefined()
})
