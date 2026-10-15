import { expect, test } from 'claude-code/testing'

import { nextMood } from './code-pet'
import type { Mood } from './code-pet'

const idle: Mood = { name: 'idle', at: 0 }

test('pet eats on a tool, gets sick on failure, is happy after a turn and sleeps when idle', () => {
  const eat = nextMood(idle, 'tool.start', 1000)
  expect(eat.name).toBe('eat')
  expect(nextMood(eat, 'tool.ok', 2000).name).toBe('idle')
  const sick = nextMood(eat, 'tool.fail', 2000)
  expect(sick.name).toBe('sick')
  expect(nextMood(sick, 'turn.done', 3000).name).toBe('sick')
  expect(nextMood(sick, 'tick', 4000)).toBe(sick)
  expect(nextMood(sick, 'tick', 8000).name).toBe('idle')
  expect(nextMood(idle, 'turn.done', 0).name).toBe('happy')
  expect(nextMood(idle, 'tick', 59000)).toBe(idle)
  const sleep = nextMood(idle, 'tick', 60000)
  expect(sleep.name).toBe('sleep')
  expect(nextMood(sleep, 'wake', 61000).name).toBe('idle')
})
