import type { Register } from 'claude-code'

const DIR = '.claude/park' // under the home folder, one <repo-name>.json per repo

type Park = { note: string; cwd: string; branch: string; prompt: string; at: number }

export const parkPath = (home: string, cwd: string): string =>
  `${home}/${DIR}/${cwd.replace(/\/+$/, '').split('/').pop() || 'root'}.json` // ponytail: folder name, not git root; a worktree parks under its own name

export const timeAgo = (at: number, now: number): string => {
  const m = Math.max(0, Math.floor((now - at) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

async function file($: any): Promise<string> {
  return parkPath(await $.env.get('HOME'), await $.session.cwd())
}

let parked: Park | null = null
let lastPrompt = ''

// Called from register.tsx's one session.start hook (the engine takes one unmatched hook per event).
export async function startPark($: any): Promise<void> {
  await $.command.register({ name: 'park', description: 'Save where you left off: /park [note], /park clear' })
  try {
    parked = JSON.parse(await $.fs.read(await file($)))
    $.ui.invalidate('ui.render')
  } catch {
    parked = null // no file, or unreadable: nothing parked
  }
}

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    if (!e.command) lastPrompt = e.text // a slash command is not where you left off
    return next(e)
  }).catch(($, e, next) => next(e)) // a failing hook passes the event on unchanged

  on('command.run', { command: 'park' }, async ($, e) => {
    const path = await file($)
    if (e.args.trim() === 'clear') {
      await $.process.run(['rm', '-f', path])
      parked = null
      $.ui.invalidate('ui.render')
      return { text: 'Park cleared.' }
    }
    const git = await $.process.run(['git', 'branch', '--show-current']).catch(() => null)
    const park: Park = {
      note: e.args.trim(),
      cwd: await $.session.cwd(),
      branch: git?.exitCode === 0 ? git.stdout.trim() : '',
      prompt: lastPrompt,
      at: await $.clock.now(),
    }
    await $.fs.write(path, JSON.stringify(park, null, 2))
    return { text: `Parked${park.note ? `: ${park.note}` : ''} (${park.branch || 'no branch'}).` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || parked === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const ago = timeAgo(parked.at, await $.clock.now())
    const below = await next(e) // stack on top of the bands beneath (pet, burn) instead of hiding them
    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>
            Parked: {parked.note || '(no note)'} ({ago}){' '}
          </Text>
          <Button
            key="dismiss"
            label="Dismiss"
            onPress={async () => {
              await $.process.run(['rm', '-f', await file($)])
              parked = null
              $.ui.invalidate('ui.render')
            }}
          />
        </Box>
        {below}
      </Box>
    )
  })
}
