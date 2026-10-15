import { expect, test } from 'claude-code/testing'

import { meter } from './burn-meter'

test('meter scales flames and bar with tokens, tokens only', () => {
  expect(meter(0)).toBe('🔥 ▁ 0 tokens')
  expect(meter(84_000)).toBe('🔥🔥 ▂ 84k tokens')
  expect(meter(300_000)).toBe('🔥🔥🔥 ▅ 300k tokens')
  expect(meter(900_000)).toBe('🔥🔥🔥🔥 ▇ 900k tokens')
})
