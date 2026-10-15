import type { Register } from 'claude-code'

export type Mood = { name: 'idle' | 'eat' | 'sick' | 'happy' | 'sleep'; at: number }
export type PetEvent = 'tool.start' | 'tool.ok' | 'tool.fail' | 'turn.done' | 'wake' | 'tick'

const SICK_MS = 5000 // sick and happy last this long, then back to idle
const SLEEP_MS = 60000 // idle this long falls asleep

// The pet's frames: one line per mood.
export const FRAMES: Record<Mood['name'], string> = {
  idle: '🐱 ...',
  eat: '😋🍖 munch munch',
  sick: '🤢 ugh, that failed',
  happy: '😸 done!',
  sleep: '😴 z z Z',
}

// Pure state machine; `now` is milliseconds since the epoch. Same mood object back means no change.
export const nextMood = (mood: Mood, event: PetEvent, now: number): Mood => {
  const to = (name: Mood['name']): Mood => (name === mood.name ? mood : { name, at: now })
  switch (event) {
    case 'tool.start':
      return to('eat')
    case 'tool.ok':
      return mood.name === 'eat' ? to('idle') : mood // keep sick/happy showing
    case 'tool.fail':
      return to('sick')
    case 'turn.done':
      return mood.name === 'sick' ? mood : to('happy') // a failure stays visible
    case 'wake':
      return mood.name === 'sleep' ? to('idle') : mood
    case 'tick':
      if ((mood.name === 'sick' || mood.name === 'happy') && now - mood.at >= SICK_MS) return { name: 'idle', at: now }
      if (mood.name === 'idle' && now - mood.at >= SLEEP_MS) return to('sleep')
      return mood
  }
}

// ponytail: module variables, not an atom, so no types/index.d.ts entry; /pet resets on a hot reload.
let mood: Mood = { name: 'idle', at: 0 }
let enabled = true
let timer: { cancel: () => void } | undefined

async function feed($: any, event: PetEvent): Promise<void> {
  const next = nextMood(mood, event, await $.clock.now())
  if (next === mood) return
  mood = next
  $.ui.invalidate('ui.render')
}

// Called from register.tsx's one session.start hook (the engine takes one unmatched hook per event).
export async function startPet($: any): Promise<void> {
  await $.command.register({ name: 'pet', description: 'Show or hide the pet above the prompt' })
  mood = { name: 'idle', at: await $.clock.now() }
  timer?.cancel()
  timer = $.clock.every(1000, () => feed($, 'tick'))
}

export const register: Register = on => {
  on('command.run', { command: 'pet' }, async $ => {
    enabled = !enabled
    $.ui.invalidate('ui.render')
    return { text: `Pet ${enabled ? 'on' : 'off'}.` }
  })

  on('tool.call', { tool: /./ }, async ($, e, next) => {
    await feed($, 'tool.start')
    const res = await next(e)
    await feed($, res.isError ? 'tool.fail' : 'tool.ok')
    return res
  }).catch(($, e, next) => next(e))

  on('turn.complete', { reason: 'answer' }, async ($, e, next) => {
    if (e.agentId === undefined) await feed($, 'turn.done')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!enabled || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e) // stack on top of the bands beneath (burn) instead of hiding them
    return (
      <Box flexDirection="column">
        <Text>{FRAMES[mood.name]}</Text>
        {below}
      </Box>
    )
  })
}
