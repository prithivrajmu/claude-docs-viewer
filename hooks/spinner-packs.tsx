import type { Register } from 'claude-code'

const FILE = '.claude/spinner-pack' // under the home folder; holds the pack name, absent for off

export const PACKS: Record<string, string[]> = {
  pirate: ['Plundering', 'Hoisting', 'Swabbing', 'Charting', 'Boarding', 'Parleying', 'Marauding', 'Careening', 'Pillaging'],
  shakespeare: ['Pondering', 'Soliloquizing', 'Thou-ing', 'Bewailing', 'Prating', 'Conjuring', 'Beseeching', 'Muttering', 'Wooing'],
  space: ['Orbiting', 'Docking', 'Launching', 'Thrusting', 'Warping', 'Landing', 'Drifting', 'Rendezvousing', 'Ascending'],
  noir: ['Sleuthing', 'Lurking', 'Stalking', 'Interrogating', 'Brooding', 'Tailing', 'Trench-coating', 'Smoldering', 'Staking out'],
}

// Same seed, same word, so a redraw does not flicker. Unknown pack: no word.
export const pickWord = (pack: string, seed: string | number): string | null => {
  const words = PACKS[pack]
  if (!words) return null
  const n = typeof seed === 'number' ? seed : [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return words[Math.abs(Math.trunc(n)) % words.length]
}

let current = '' // '' is off

// Called from register.tsx's one session.start hook (the engine takes one unmatched hook per event).
export async function startSpinners($: any): Promise<void> {
  await $.command.register({ name: 'spinner', description: 'Themed spinner words: /spinner <pirate|shakespeare|space|noir|off|list>' })
  const saved = (await $.fs.read(`${await $.env.get('HOME')}/${FILE}`).catch(() => '')).trim()
  current = saved in PACKS ? saved : ''
}

export const register: Register = on => {
  on('command.run', { command: 'spinner' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'list' || arg === '') {
      return { text: `Packs: ${Object.keys(PACKS).join(', ')}, off. Now: ${current || 'off'}.` }
    }
    if (arg !== 'off' && !(arg in PACKS)) return { text: `Unknown pack "${arg}". Try /spinner list.` }
    current = arg === 'off' ? '' : arg
    await $.fs.write(`${await $.env.get('HOME')}/${FILE}`, current)
    return { text: `Spinner pack: ${current || 'off'}.` }
  }).catch(() => ({ text: 'Spinner pack could not be changed.' }))

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const word = current ? pickWord(current, e.props.word) : null
    // a message override (a state's own text) is left alone
    return word && e.props.message === null ? next({ ...e, props: { ...e.props, word } }) : next(e)
  }).catch(($, e, next) => next(e)) // a failing hook passes the event on unchanged
}
