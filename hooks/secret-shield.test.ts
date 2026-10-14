import { expect, test } from 'claude-code/testing'

import { redact } from './secret-shield'

test('redacts keys, tokens, private keys and password= values, and counts them', () => {
  const aws = 'AKIAIOSFODNN7EXAMPLE'
  const gh = 'ghp_' + 'a'.repeat(36)
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'
  const r = redact(`id ${aws}\n${gh}\npassword=hunter22\n${pem}\nplain text`)
  expect(r.count).toBe(4)
  expect(r.text).not.toContain(aws)
  expect(r.text).not.toContain(gh)
  expect(r.text).not.toContain('hunter22')
  expect(r.text).not.toContain('abc')
  expect(r.text).toContain('password=[REDACTED]')
  expect(r.text).toContain('plain text')
})

test('leaves clean text alone', () => {
  expect(redact('nothing to see')).toEqual({ text: 'nothing to see', count: 0 })
})
