import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// ponytail: the on/off flag is keyed under 'repo-docs'; types/index.d.ts must declare `isReceiptOn: boolean` there.
const isOn = atom({ plugin: 'repo-docs', key: 'isReceiptOn' } as const, true)

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

const k = (n: number): string => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`)

// "Took 12s - 3 tool calls - 1.2k in / 340 out"; tokens are left out when the API gave none.
export const formatReceipt = (ms: number, tools: number, usage?: Usage): string => {
  const s = Math.round(ms / 1000)
  const parts = [`Took ${s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`}`, `${tools} tool call${tools === 1 ? '' : 's'}`]
  if (usage) {
    const input = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
    parts.push(`${k(input)} in / ${k(usage.output_tokens)} out`)
  }
  return parts.join(' - ')
}

// Called from register.tsx's one session.start hook (the engine takes one unmatched hook per event).
export async function startReceipt($: any): Promise<void> {
  await $.command.register({ name: 'receipt', description: 'Turn the one-line receipt under each answer on or off' })
}

export const register: Register = on => {
  let tools = 0 // main-loop tool calls since the turn began; subagent turns are not counted apart

  on('command.run', { command: 'receipt' }, async $ => {
    const next = !(await read($, isOn))
    await update($, isOn, () => next)
    return { text: `Turn receipt ${next ? 'on' : 'off'}.` }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) tools = 0
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    tools += 1
    return next(e)
  }).catch(($, e, next) => next(e)) // a failing hook passes the event on unchanged

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId !== undefined || !(await read($, isOn))) return res
    return { ...res, text: formatReceipt(e.durationMs, tools, e.usage) }
  })
}
