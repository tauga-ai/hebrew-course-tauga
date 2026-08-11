import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAnswer, placementLevel, difficultyLadder, pickNextTopic, type TopicState } from '../src/lib/naale/leveling'

const fresh = (level = 3): TopicState => ({ level, correct_streak: 0, wrong_streak: 0 })

test('applyAnswer: a single correct answer does not change the level', () => {
  const after = applyAnswer(fresh(), true)
  assert.equal(after.level, 3)
  assert.equal(after.correct_streak, 1)
})

test('applyAnswer: 2 correct in a row levels up and resets the streak', () => {
  const after = applyAnswer(applyAnswer(fresh(), true), true)
  assert.equal(after.level, 4)
  assert.equal(after.correct_streak, 0)
})

test('applyAnswer: a wrong answer keeps the level but breaks the correct streak', () => {
  const afterOneCorrect = applyAnswer(fresh(), true)
  const afterWrong = applyAnswer(afterOneCorrect, false)
  assert.equal(afterWrong.level, 3)
  assert.equal(afterWrong.correct_streak, 0, 'the in-progress correct streak must be broken')
  // ...so one more correct is NOT enough to level up; it takes 2 fresh ones.
  assert.equal(applyAnswer(afterWrong, true).level, 3)
  assert.equal(applyAnswer(applyAnswer(afterWrong, true), true).level, 4)
})

test('applyAnswer: 3 wrong in a row levels down', () => {
  let s = fresh()
  s = applyAnswer(s, false)
  assert.equal(s.level, 3)
  s = applyAnswer(s, false)
  assert.equal(s.level, 3)
  s = applyAnswer(s, false)
  assert.equal(s.level, 2)
  assert.equal(s.wrong_streak, 0)
})

test('applyAnswer: 2 wrong then a correct answer resets the wrong streak', () => {
  let s = applyAnswer(applyAnswer(fresh(), false), false)
  assert.equal(s.wrong_streak, 2)
  s = applyAnswer(s, true)
  assert.equal(s.wrong_streak, 0, 'a correct answer must clear the wrong streak')
  // The next 2 wrong answers must therefore NOT drop the level.
  s = applyAnswer(applyAnswer(s, false), false)
  assert.equal(s.level, 3)
})

test('applyAnswer: level never leaves the 1-5 range', () => {
  let low = fresh(1)
  for (let i = 0; i < 9; i++) low = applyAnswer(low, false)
  assert.equal(low.level, 1)

  let high = fresh(5)
  for (let i = 0; i < 9; i++) high = applyAnswer(high, true)
  assert.equal(high.level, 5)
})

test('placementLevel: correct starts at 3, incorrect at 1', () => {
  assert.equal(placementLevel(true), 3)
  assert.equal(placementLevel(false), 1)
})

test('difficultyLadder: current level first, then one harder, then easier', () => {
  assert.deepEqual(difficultyLadder(3), [3, 4, 2, 1, 5])
  assert.deepEqual(difficultyLadder(1), [1, 2, 3, 4, 5])
  assert.deepEqual(difficultyLadder(5), [5, 4, 3, 2, 1])
})

test('difficultyLadder: covers every level exactly once', () => {
  for (let level = 1; level <= 5; level++) {
    assert.deepEqual([...difficultyLadder(level)].sort(), [1, 2, 3, 4, 5])
  }
})

test('pickNextTopic: never returns the previous topic when alternatives exist', () => {
  for (let i = 0; i < 50; i++) {
    assert.notEqual(pickNextTopic(['a', 'b', 'c'], 'a'), 'a')
  }
})

test('pickNextTopic: falls back to the only topic rather than deadlocking', () => {
  assert.equal(pickNextTopic(['a'], 'a'), 'a')
  assert.equal(pickNextTopic([], null), null)
})
