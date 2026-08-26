import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStudentProgress, buildTopicStats, buildSessionProgress, groupSessionsByDay, buildAttendanceWindow } from '../src/lib/naale/stats'

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

/**
 * buildStudentProgress() exists because /api/naale/my-stats and
 * /api/naale/staff/students used to derive these numbers from two separate
 * copies of the logic, and drifted: the staff copy read only the MCQ bank, so
 * every AI-graded topic vanished from staff's view while the student's own
 * screen showed it (audit H1). These tests pin the behaviours that divergence
 * broke.
 */
const SESSIONS = [
  { id: 'p1', kind: 'practice', completed: true },
  { id: 'plc', kind: 'placement', completed: false },
]
const TOPICS = ['הבנת הנקרא', 'סיפור בהמשכים'] // reading comprehension, story continuation

test('buildStudentProgress: AI-graded topics appear with their own counts', () => {
  const { topics } = buildStudentProgress({
    allTopics: TOPICS,
    levels: [{ topic: 'סיפור בהמשכים', level: 3 }],
    answers: [],
    openAnswers: [
      { topic: 'סיפור בהמשכים', score: 5, is_review: false, session_id: 'p1' },
      { topic: 'סיפור בהמשכים', score: 2, is_review: false, session_id: 'p1' },
    ],
    sessions: SESSIONS,
  })
  const story = topics.find(t => t.topic === 'סיפור בהמשכים')!
  assert.equal(story.level, 3)
  assert.equal(story.answered, 2)
  assert.equal(story.correct, 1)
  assert.equal(story.started, true)
})

test('buildStudentProgress: a graded 3 is not "correct", a 4 is', () => {
  const scored = (score: number) => buildStudentProgress({
    allTopics: TOPICS,
    levels: [],
    answers: [],
    openAnswers: [{ topic: 'סיפור בהמשכים', score, is_review: false, session_id: 'p1' }],
    sessions: SESSIONS,
  }).totals.correct
  assert.equal(scored(3), 0)
  assert.equal(scored(4), 1)
})

test('buildStudentProgress: review answers are excluded from every count', () => {
  const { topics, totals } = buildStudentProgress({
    allTopics: TOPICS,
    levels: [],
    answers: [{ topic: 'הבנת הנקרא', is_correct: true, is_review: true, session_id: 'p1' }],
    openAnswers: [{ topic: 'סיפור בהמשכים', score: 5, is_review: true, session_id: 'p1' }],
    sessions: SESSIONS,
  })
  assert.equal(totals.answered, 0)
  assert.equal(totals.correct, 0)
  assert.equal(totals.xp, 50, 'only the completed-session bonus remains')
  assert.deepEqual(topics.map(t => t.answered), [0, 0])
})

test('buildStudentProgress: placement answers count as answered but earn no XP', () => {
  // Placement is calibration, not practice — same rule the leveling streak uses.
  const { totals } = buildStudentProgress({
    allTopics: TOPICS,
    levels: [],
    answers: [{ topic: 'הבנת הנקרא', is_correct: true, is_review: false, session_id: 'plc' }],
    openAnswers: [{ topic: 'סיפור בהמשכים', score: 5, is_review: false, session_id: 'plc' }],
    sessions: SESSIONS,
  })
  assert.equal(totals.answered, 2)
  assert.equal(totals.correct, 2)
  assert.equal(totals.coins, 0)
  assert.equal(totals.xp, 50, 'the completed-session bonus only; no per-answer XP')
})

test('buildStudentProgress: MCQ and graded answers combine into one set of totals', () => {
  const { totals } = buildStudentProgress({
    allTopics: TOPICS,
    levels: [],
    answers: [
      { topic: 'הבנת הנקרא', is_correct: true, is_review: false, session_id: 'p1' },
      { topic: 'הבנת הנקרא', is_correct: false, is_review: false, session_id: 'p1' },
    ],
    openAnswers: [{ topic: 'סיפור בהמשכים', score: 5, is_review: false, session_id: 'p1' }],
    sessions: SESSIONS,
  })
  assert.equal(totals.answered, 3)
  assert.equal(totals.correct, 2)
  assert.equal(totals.sessions, 2)
  assert.equal(totals.completed_sessions, 1)
  // 10 (one correct MCQ) + 10 (a graded 5) + 50 (completed session)
  assert.equal(totals.xp, 70)
  assert.equal(totals.coins, 2)
})

/**
 * buildSessionProgress() (naale-session-breakdown) scopes buildStudentProgress()
 * to one session's own rows — only topics actually touched appear, and level
 * comes from level_at_answer rather than the student's current live level.
 */
test('buildSessionProgress: only topics touched in this session appear', () => {
  const { topics } = buildSessionProgress(
    's1', 'practice', true,
    [{ topic: 'הבנת הנקרא', is_correct: true, level_at_answer: 2 }],
    []
  )
  assert.deepEqual(topics.map(t => t.topic), ['הבנת הנקרא'])
})

test('buildSessionProgress: level reflects level_at_answer, not a passed-in current level', () => {
  const { topics } = buildSessionProgress(
    's1', 'practice', true,
    [],
    [{ topic: 'סיפור בהמשכים', score: 5, level_at_answer: 4 }]
  )
  assert.equal(topics[0].level, 4)
})

test('buildSessionProgress: totals match a hand-computed sum for mixed MCQ/graded rows', () => {
  const { totals } = buildSessionProgress(
    's1', 'practice', true,
    [
      { topic: 'הבנת הנקרא', is_correct: true, level_at_answer: 2 },
      { topic: 'הבנת הנקרא', is_correct: false, level_at_answer: 2 },
    ],
    [{ topic: 'סיפור בהמשכים', score: 5, level_at_answer: 3 }]
  )
  assert.equal(totals.answered, 3)
  assert.equal(totals.correct, 2)
  assert.equal(totals.sessions, 1)
  assert.equal(totals.completed_sessions, 1)
  // 10 (one correct MCQ) + 10 (a graded 5) + 50 (completed session)
  assert.equal(totals.xp, 70)
  assert.equal(totals.coins, 2)
})

test('groupSessionsByDay: two sessions on one day collapse into one entry', () => {
  const days = groupSessionsByDay([
    { id: 's2', started_at: '2026-08-25T14:00:00.000Z' },
    { id: 's1', started_at: '2026-08-25T09:00:00.000Z' },
  ])
  assert.equal(days.length, 1, 'same calendar day is one row, not two identical dates')
  assert.equal(days[0].count, 2)
  assert.deepEqual(days[0].session_ids.sort(), ['s1', 's2'])
  assert.equal(days[0].latest, '2026-08-25T14:00:00.000Z', 'latest session drives the sort')
})

test('groupSessionsByDay: different days stay separate, newest first', () => {
  const days = groupSessionsByDay([
    { id: 'a', started_at: '2026-08-24T09:00:00.000Z' },
    { id: 'b', started_at: '2026-08-26T09:00:00.000Z' },
    { id: 'c', started_at: '2026-08-25T09:00:00.000Z' },
  ])
  assert.equal(days.length, 3)
  assert.deepEqual(days.map(d => d.session_ids[0]), ['b', 'c', 'a'])
  assert.ok(days.every(d => d.count === 1))
})

test('groupSessionsByDay: no sessions yields no rows', () => {
  assert.deepEqual(groupSessionsByDay([]), [])
})

test('buildAttendanceWindow: one cell per day, oldest first, today last', () => {
  const now = new Date('2026-08-26T10:00:00.000Z')
  const days = buildAttendanceWindow([], now, 7)
  assert.equal(days.length, 7)
  assert.equal(days[6].isToday, true, 'today is the last cell')
  assert.ok(days.slice(0, 6).every(d => !d.isToday))
  assert.ok(days.every(d => d.count === 0), 'no sessions means an empty strip, not a missing one')
})

test('buildAttendanceWindow: sessions land on their day and same-day sessions add up', () => {
  const now = new Date('2026-08-26T10:00:00.000Z')
  const days = buildAttendanceWindow(
    [
      { id: 'a', started_at: '2026-08-26T07:00:00.000Z' },
      { id: 'b', started_at: '2026-08-26T09:00:00.000Z' },
      { id: 'c', started_at: '2026-08-24T09:00:00.000Z' },
    ],
    now,
    7
  )
  assert.equal(days[6].count, 2, 'two sessions today')
  assert.equal(days[4].count, 1, 'one session two days ago')
  assert.equal(days.reduce((n, d) => n + d.count, 0), 3, 'every session is counted exactly once')
})

test('buildAttendanceWindow: sessions older than the window are dropped, not folded in', () => {
  const now = new Date('2026-08-26T10:00:00.000Z')
  const days = buildAttendanceWindow([{ id: 'old', started_at: '2026-01-01T09:00:00.000Z' }], now, 7)
  assert.equal(days.reduce((n, d) => n + d.count, 0), 0)
})
