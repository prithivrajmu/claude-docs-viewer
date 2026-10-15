import { expect, test } from 'claude-code/testing'
import { PACKS, pickWord } from './spinner-packs'

test('pickWord is stable per seed and stays inside the pack', () => {
  expect(pickWord('pirate', 'Sauteing')).toBe(pickWord('pirate', 'Sauteing'))
  for (const pack of Object.keys(PACKS)) {
    for (const seed of ['a', 'Sauteing', 12345, 0]) expect(PACKS[pack]).toContain(pickWord(pack, seed))
  }
  expect(pickWord('pirate', 0)).toBe('Plundering')
  expect(pickWord('nope', 1)).toBe(null)
})
