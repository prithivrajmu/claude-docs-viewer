import type { Register } from 'claude-code'

const BARS = '▁▂▃▄▅▆▇'
const TIERS = [
  { max: 50_000, flames: '🔥', color: '#4fc3f7' }, // cool
  { max: 200_000, flames: '🔥🔥', color: '#ffd54f' }, // warm
  { max: 500_000, flames: '🔥🔥🔥', color: '#ff9800' }, // hot
  { max: Infinity, flames: '🔥🔥🔥🔥', color: '#f44336' }, // inferno
]

const k = (n: number): string => (n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}k`)

const tier = (tokens: number) => TIERS.find(t => tokens < t.max) ?? TIERS[TIERS.length - 1]

// "🔥🔥 ▃ 84k tokens"; the bar fills up to 500k. Tokens only, no plan-quota numbers.
export const meter = (tokens: number): string => {
  const bar = BARS[Math.min(BARS.length - 1, Math.floor((tokens / 500_000) * BARS.length))]
  return `${tier(tokens).flames} ${bar} ${k(tokens)} tokens`
}

let spent = 0 // tokens this session, main loop and subagents; a hot reload starts it over
let isOn = true

// Called from register.tsx's one session.start hook (the engine takes one unmatched hook per event).
export async function startBurn($: any): Promise<void> {
  await $.command.register({ name: 'burn', description: 'Show or hide the session token burn meter above the prompt' })
}

export const register: Register = on => {
  on('command.run', { command: 'burn' }, async $ => {
    isOn = !isOn
    $.ui.invalidate('ui.render')
    return { text: `Burn meter ${isOn ? 'on' : 'off'}.` }
  })

  on('turn.complete', { reason: 'answer' }, async ($, e, next) => {
    const u = e.usage
    if (u) {
      // matcher: turn-receipt owns the one unmatched turn.complete hook; aborted/error turns are not counted.
      // same sum as turn-receipt: fresh input + cache reads + cache writes + output
      spent += u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens + u.output_tokens
      $.ui.invalidate('ui.render')
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // a failing hook passes the event on unchanged

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !isOn || spent === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e) // keep whatever is beneath this band
    return (
      <Box flexDirection="column">
        <Text color={tier(spent).color}>{meter(spent)}</Text>
        {below}
      </Box>
    )
  })
}
