import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRewards,
  weekKey,
  computeStreak,
  XP_PER_CORRECT,
  XP_PER_COMPLETED_SESSION,
  COINS_PER_CORRECT,
} from '../src/lib/naale/rewards'

test('computeRewards: XP and coins from correct answers plus completed sessions', () => {
  const answers = [{ is_correct: true }, { is_correct: true }, { is_correct: false }]
  const sessions = [{ completed: true }, { completed: false }]
  const { xp, coins } = computeRewards(answers, sessions)
  assert.equal(xp, 2 * XP_PER_CORRECT + 1 * XP_PER_COMPLETED_SESSION)
  assert.equal(coins, 2 * COINS_PER_CORRECT)
})

test('computeRewards: no completed sessions means no bonus, only answer XP', () => {
  const { xp, coins } = computeRewards([{ is_correct: true }], [{ completed: false }])
  assert.equal(xp, XP_PER_CORRECT)
  assert.equal(coins, COINS_PER_CORRECT)
})

// Real-calendar anchors, verified independently before writing this test:
// 2026-08-09 and 2026-08-16 are both Sundays in Israel time.
test('weekKey: 23:59 Saturday (Israel time) stays in the ending week', () => {
  const saturdayLateNight = new Date('2026-08-15T20:59:00Z') // Sat 23:59 IL
  const sameWeekMidweek = new Date('2026-08-09T12:00:00Z') // Sun 15:00 IL, same week
  assert.equal(weekKey(saturdayLateNight), weekKey(sameWeekMidweek))
  assert.equal(weekKey(saturdayLateNight), '2026-08-09')
})

test('weekKey: one minute later (00:59 Sunday Israel time) rolls into the next week', () => {
  const justAfterMidnight = new Date('2026-08-15T21:59:00Z') // Sun 00:59 IL — next week
  const nextWeekMidweek = new Date('2026-08-16T12:00:00Z') // Sun 15:00 IL, same (next) week
  assert.equal(weekKey(justAfterMidnight), weekKey(nextWeekMidweek))
  assert.equal(weekKey(justAfterMidnight), '2026-08-16')
  assert.notEqual(weekKey(justAfterMidnight), weekKey(new Date('2026-08-09T12:00:00Z')))
})

test('computeStreak: an in-progress current week with fewer than 2 sessions does not break a real streak', () => {
  const completed = [
    new Date('2026-08-09T12:00:00Z'), // week 08-09
    new Date('2026-08-11T12:00:00Z'), // week 08-09 (2nd session — qualifies)
  ]
  const now = new Date('2026-08-16T12:00:00Z') // week 08-16, 0 sessions so far, still open
  assert.equal(computeStreak(completed, now), 1)
})

test('computeStreak: a week with only 1 completed session does not qualify', () => {
  const completed = [new Date('2026-08-09T12:00:00Z')] // only 1 in week 08-09
  const now = new Date('2026-08-16T12:00:00Z')
  assert.equal(computeStreak(completed, now), 0)
})

test('computeStreak: a gap week resets the streak to 0, even if an older week qualified', () => {
  const completed = [
    new Date('2026-08-09T12:00:00Z'), // week 08-09: 2 sessions
    new Date('2026-08-11T12:00:00Z'),
    // week 08-16: nothing — the gap
  ]
  const now = new Date('2026-08-23T12:00:00Z') // week 08-23, still open, 0 sessions
  assert.equal(computeStreak(completed, now), 0)
})

test('computeStreak: three consecutive qualifying weeks builds a streak of 3', () => {
  const completed = [
    new Date('2026-08-09T09:00:00Z'), new Date('2026-08-11T09:00:00Z'), // week 08-09
    new Date('2026-08-16T09:00:00Z'), new Date('2026-08-18T09:00:00Z'), // week 08-16
    new Date('2026-08-23T09:00:00Z'), new Date('2026-08-25T09:00:00Z'), // week 08-23
  ]
  const now = new Date('2026-08-30T12:00:00Z') // week 08-30, still open, 0 sessions
  assert.equal(computeStreak(completed, now), 3)
})
