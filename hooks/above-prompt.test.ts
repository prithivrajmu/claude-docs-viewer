import { expect, test } from 'claude-code/testing'

// park, code-pet and burn-meter each draw a band above the prompt; each stacks on what is beneath, so all show.
test('park and pet bands both show above the prompt', async ($: any, on: any) => {
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.read', (_$: any, e: any) =>
    String(e.path).includes('/.claude/park/') ? { value: JSON.stringify({ note: 'fix login', branch: 'main', prompt: '', at: 0 }) } : { deny: 'ENOENT' },
  )
  on('command.register', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: '/work/my-app' }))
  on('clock.now', () => ({ value: 1000 }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work/my-app' }))
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] })) // the engine's empty band
  await $.session.start({ source: 'startup', cwd: '/work/my-app' })
  const ui = await $.ui.mount({ plugin: 'repo-docs', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false } })
  expect(await ui.find({ type: 'Text', text: /Parked: fix login/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🐱/ })).toBeDefined()
})
