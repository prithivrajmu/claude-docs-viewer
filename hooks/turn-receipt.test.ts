import { expect, test } from 'claude-code/testing'

import { formatReceipt } from './turn-receipt'

const usage = { input_tokens: 200, output_tokens: 340, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 }

test('receipt shows time, tool calls and tokens, and omits tokens when the API gave none', () => {
  expect(formatReceipt(12400, 3, usage)).toBe('Took 12s - 3 tool calls - 1.2k in / 340 out')
  expect(formatReceipt(75000, 1)).toBe('Took 1m 15s - 1 tool call')
})
