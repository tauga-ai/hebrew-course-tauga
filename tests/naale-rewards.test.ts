import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRewards,
  weekKey,
  computeStreak,
  computeGradedRewards,
  gradedAnswerReward,
  consecutiveGoodScoreStreak,
  STREAK_MILESTONES,
  XP_PER_CORRECT,
  XP_PER_COMPLETED_SESSION,
  COINS_PER_CORRECT,
  XP_BY_SCORE,
  COIN_SCORE_THRESHOLD,
  countsTowardStreak,
  countsAsTrackedSession,
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

// naale-topic-based-sessions: both default to excluding topic sessions —
// streak's exclusion is confirmed by the spec, completed-session credit is
// the ticket's one pending decision (see rewards.ts's own doc comments and
// task.md §1 for the reasoning and how to flip it if Noam answers otherwise).
test('countsTowardStreak: excludes topic sessions, includes everything else', () => {
  assert.equal(countsTowardStreak({ kind: 'topic' }), false)
  assert.equal(countsTowardStreak({ kind: 'practice' }), true)
  assert.equal(countsTowardStreak({ kind: 'placement' }), true)
})

test('countsAsTrackedSession: excludes topic sessions, includes everything else', () => {
  assert.equal(countsAsTrackedSession({ kind: 'topic' }), false)
  assert.equal(countsAsTrackedSession({ kind: 'practice' }), true)
  assert.equal(countsAsTrackedSession({ kind: 'placement' }), true)
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

test('computeGradedRewards: XP follows the fixed schedule, coins only at the threshold', () => {
  const answers = [{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }, { score: 5 }]
  const { xp, coins } = computeGradedRewards(answers)
  assert.equal(xp, XP_BY_SCORE[1] + XP_BY_SCORE[2] + XP_BY_SCORE[3] + XP_BY_SCORE[4] + XP_BY_SCORE[5])
  // Only the score-4 and score-5 answers clear COIN_SCORE_THRESHOLD.
  assert.equal(coins, 2 * COINS_PER_CORRECT)
  assert.equal(COIN_SCORE_THRESHOLD, 4)
})

test('computeGradedRewards: no answers means no XP and no coins', () => {
  const { xp, coins } = computeGradedRewards([])
  assert.equal(xp, 0)
  assert.equal(coins, 0)
})

test('consecutiveGoodScoreStreak: counts a leading run of scores >= 4, stops at the first below', () => {
  assert.equal(consecutiveGoodScoreStreak([{ score: 5 }, { score: 4 }, { score: 3 }, { score: 5 }]), 2)
  assert.equal(consecutiveGoodScoreStreak([{ score: 5 }, { score: 5 }, { score: 5 }]), 3)
  assert.equal(consecutiveGoodScoreStreak([{ score: 2 }, { score: 5 }, { score: 5 }]), 0)
  assert.equal(consecutiveGoodScoreStreak([]), 0)
})

// The in-session "+N XP · +1 🪙" note (#18). These pin the two things the UI
// branches on: whether there is anything to show at all, and whether a coin
// is part of it.
test('gradedAnswerReward: each score earns its scheduled XP, coin only at the threshold', () => {
  assert.deepEqual(gradedAnswerReward(1), { xp: 0, coins: 0 })
  assert.deepEqual(gradedAnswerReward(2), { xp: XP_BY_SCORE[2], coins: 0 })
  assert.deepEqual(gradedAnswerReward(3), { xp: XP_BY_SCORE[3], coins: 0 })
  assert.deepEqual(gradedAnswerReward(4), { xp: XP_BY_SCORE[4], coins: COINS_PER_CORRECT })
  assert.deepEqual(gradedAnswerReward(5), { xp: XP_BY_SCORE[5], coins: COINS_PER_CORRECT })
})

// A score of 1 is worth nothing, and the session screen relies on that to skip
// the note entirely rather than showing a deflating "+0 XP".
test('gradedAnswerReward: a score of 1 is worth nothing, so the UI has nothing to show', () => {
  assert.equal(gradedAnswerReward(1).xp, 0)
  assert.equal(gradedAnswerReward(1).coins, 0)
})

// The server validates 1-5 before this is reached; an out-of-range score is a
// bug to survive rather than one to crash a student's session over.
test('gradedAnswerReward: an unrecognised score earns nothing instead of throwing', () => {
  assert.deepEqual(gradedAnswerReward(0), { xp: 0, coins: 0 })
  assert.deepEqual(gradedAnswerReward(9), { xp: 0, coins: COINS_PER_CORRECT })
})

// The whole point of routing computeGradedRewards() through gradedAnswerReward():
// the end-of-session total must be exactly the sum of what each answer showed.
test('computeGradedRewards: the total equals the sum of the per-answer notes', () => {
  const answers = [{ score: 5 }, { score: 3 }, { score: 4 }, { score: 1 }, { score: 2 }]
  const summed = answers.reduce(
    (acc, a) => {
      const r = gradedAnswerReward(a.score)
      return { xp: acc.xp + r.xp, coins: acc.coins + r.coins }
    },
    { xp: 0, coins: 0 }
  )
  assert.deepEqual(computeGradedRewards(answers), summed)
})

// The milestone banner fires on an exact match, not a threshold — so a streak
// of 4 celebrates nothing, and the "10 in a row" moment happens once.
test('STREAK_MILESTONES: only exact streak lengths celebrate', () => {
  const fires = (streak: number) =>
    STREAK_MILESTONES.includes(streak as typeof STREAK_MILESTONES[number])
  assert.equal(fires(3), true)
  assert.equal(fires(5), true)
  assert.equal(fires(10), true)
  assert.equal(fires(4), false)
  assert.equal(fires(9), false)
  assert.equal(fires(11), false)
})
