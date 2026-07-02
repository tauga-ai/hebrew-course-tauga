import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shuffleWithSeed, shuffle } from '../src/lib/shuffle'

function isPermutationOf<T>(result: T[], original: T[]) {
  return result.length === original.length &&
    [...result].sort().every((v, i) => v === [...original].sort()[i])
}

test('shuffleWithSeed: same seed always produces the same order (deterministic)', () => {
  const a = shuffleWithSeed([1, 2, 3, 4], 42)
  const b = shuffleWithSeed([1, 2, 3, 4], 42)
  assert.deepEqual(a, b)
})

test('shuffleWithSeed: result is a permutation of the input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7]
  const result = shuffleWithSeed(input, 7)
  assert.ok(isPermutationOf(result, input))
})

test('shuffleWithSeed: does not mutate the input array', () => {
  const input = [1, 2, 3, 4]
  const copy = [...input]
  shuffleWithSeed(input, 5)
  assert.deepEqual(input, copy)
})

test('shuffleWithSeed: empty and single-element arrays are returned unchanged', () => {
  assert.deepEqual(shuffleWithSeed([], 1), [])
  assert.deepEqual(shuffleWithSeed([9], 1), [9])
})

test('shuffle: result is a permutation of the input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8]
  const result = shuffle(input)
  assert.ok(isPermutationOf(result, input))
})

test('shuffle: does not mutate the input array', () => {
  const input = [1, 2, 3, 4]
  const copy = [...input]
  shuffle(input)
  assert.deepEqual(input, copy)
})

test('shuffle: empty and single-element arrays are returned unchanged', () => {
  assert.deepEqual(shuffle([]), [])
  assert.deepEqual(shuffle(['x']), ['x'])
})

test('shuffle: works with non-numeric element types', () => {
  const input = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const result = shuffle(input)
  assert.equal(result.length, 3)
  assert.deepEqual([...result].map(x => x.id).sort(), [1, 2, 3])
})
