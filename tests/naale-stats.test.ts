import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTopicStats } from '../src/lib/naale/stats'

test('buildTopicStats: includes topics the student has never touched', () => {
  const stats = buildTopicStats(['a', 'b'], [{ topic: 'a', level: 3 }], [{ topic: 'a', is_correct: true }])
  assert.equal(stats.length, 2)
  const b = stats.find(s => s.topic === 'b')!
  assert.equal(b.started, false)
  assert.equal(b.level, null)
  assert.equal(b.accuracy_pct, null, 'no attempts means no percentage, not 0%')
})

test('buildTopicStats: accuracy is null at zero attempts, computed otherwise', () => {
  const stats = buildTopicStats(
    ['a'],
    [{ topic: 'a', level: 2 }],
    [{ topic: 'a', is_correct: true }, { topic: 'a', is_correct: false }]
  )
  assert.equal(stats[0].answered, 2)
  assert.equal(stats[0].correct, 1)
  assert.equal(stats[0].accuracy_pct, 50)
})

test('buildTopicStats: a topic with answers but no level row still counts as started', () => {
  const stats = buildTopicStats(['a'], [], [{ topic: 'a', is_correct: true }])
  assert.equal(stats[0].started, true)
  assert.equal(stats[0].level, null)
})
