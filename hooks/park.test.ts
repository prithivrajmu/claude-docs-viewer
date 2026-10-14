import { expect, test } from 'claude-code/testing'
import { parkPath, timeAgo } from './park'

test('timeAgo says minutes, hours, days', () => {
  const now = 10 * 86400000
  expect(timeAgo(now, now)).toBe('just now')
  expect(timeAgo(now - 5 * 60000, now)).toBe('5m ago')
  expect(timeAgo(now - 3 * 3600000, now)).toBe('3h ago')
  expect(timeAgo(now - 2 * 86400000, now)).toBe('2d ago')
  expect(timeAgo(now + 1000, now)).toBe('just now') // clock skew never goes negative
})

test('parkPath is <home>/.claude/park/<repo-name>.json', () => {
  expect(parkPath('/home/me', '/work/my-app')).toBe('/home/me/.claude/park/my-app.json')
  expect(parkPath('/home/me', '/work/my-app/')).toBe('/home/me/.claude/park/my-app.json')
})
