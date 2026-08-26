import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collapseToMistakes, isOpenAnswerWrong, diffAnswers, promptSummary, type MistakeAttempt } from '../src/lib/naale/mistakes'

function attempt(over: Partial<MistakeAttempt> & { question_id: string; answered_at: string; was_correct: boolean }): MistakeAttempt {
  return {
    session_id: 's1',
    topic: 'הבנת הנקרא',
    kind: 'mcq',
    answer_text: 'x',
    is_review: false,
    ...over,
  }
}

test('collapseToMistakes: a question whose latest attempt is wrong is a mistake', () => {
  const out = collapseToMistakes([attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false })])
  assert.equal(out.length, 1)
  assert.equal(out[0].attempt_count, 1)
})

test('collapseToMistakes: answering it right later clears it', () => {
  const out = collapseToMistakes([
    attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false }),
    attempt({ question_id: 'q1', answered_at: '2026-08-22T09:00:00Z', was_correct: true, is_review: true }),
  ])
  assert.deepEqual(out, [], 'a corrected mistake stops being a mistake')
})

test('collapseToMistakes: getting it wrong again after a correct attempt brings it back', () => {
  const out = collapseToMistakes([
    attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false }),
    attempt({ question_id: 'q1', answered_at: '2026-08-21T09:00:00Z', was_correct: true }),
    attempt({ question_id: 'q1', answered_at: '2026-08-22T09:00:00Z', was_correct: false }),
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].attempt_count, 2, 'counts wrong attempts only, not the correct one')
})

test('collapseToMistakes: repeats collapse to one entry showing the latest attempt', () => {
  const out = collapseToMistakes([
    attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false, answer_text: 'first' }),
    attempt({ question_id: 'q1', answered_at: '2026-08-21T09:00:00Z', was_correct: false, answer_text: 'second' }),
    attempt({ question_id: 'q1', answered_at: '2026-08-22T09:00:00Z', was_correct: false, answer_text: 'third' }),
  ])
  assert.equal(out.length, 1, 'one question is one entry, however many times it was served')
  assert.equal(out[0].attempt_count, 3)
  assert.equal(out[0].answer_text, 'third', 'shows the most recent attempt')
})

test('collapseToMistakes: attempt order in the input does not matter', () => {
  const shuffled = collapseToMistakes([
    attempt({ question_id: 'q1', answered_at: '2026-08-22T09:00:00Z', was_correct: true }),
    attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false }),
  ])
  assert.deepEqual(shuffled, [], 'the latest attempt decides even when it arrives first')
})

test('collapseToMistakes: MCQ and open questions coexist, newest first', () => {
  const out = collapseToMistakes([
    attempt({ question_id: 'q1', answered_at: '2026-08-20T09:00:00Z', was_correct: false }),
    attempt({ question_id: 'q2', answered_at: '2026-08-24T09:00:00Z', was_correct: false, kind: 'open', topic: 'ווטסאפ והודעות', feedback: 'fb' }),
  ])
  assert.deepEqual(out.map(m => m.question_id), ['q2', 'q1'])
  assert.equal(out[0].kind, 'open')
  assert.equal(out[0].feedback, 'fb')
})

test('collapseToMistakes: no attempts, no mistakes', () => {
  assert.deepEqual(collapseToMistakes([]), [])
})

test('isOpenAnswerWrong: uses the same passing threshold as the stats screens', () => {
  assert.equal(isOpenAnswerWrong(3), true)
  assert.equal(isOpenAnswerWrong(4), false, '4 is a pass everywhere else, so it is not a mistake here')
  assert.equal(isOpenAnswerWrong(5), false)
})

test('promptSummary: uses the last line, where the actual question lives', () => {
  assert.equal(
    promptSummary('תקן את המשפט הבא:\nהשיר הזה יותר יפה כמו השיר שהיא שרה.'),
    'השיר הזה יותר יפה כמו השיר שהיא שרה.',
    'the instruction line is not the question'
  )
  assert.equal(promptSummary('פסקה ארוכה כאן.\n\nמה ניתן להסיק?'), 'מה ניתן להסיק?')
  assert.equal(promptSummary('שורה אחת'), 'שורה אחת')
})

test('diffAnswers: narrows a near-identical sentence to the changed word', () => {
  const d = diffAnswers(
    'המכונית שלנו הכי חדשה מהמכונית שלכם.',
    'המכונית שלנו יותר חדשה מהמכונית שלכם.'
  )
  assert.equal(d.was, 'הכי')
  assert.equal(d.is, 'יותר')
  assert.equal(d.narrowed, true)
})

test('diffAnswers: unrelated answers are shown in full', () => {
  const d = diffAnswers('לא קנו את האלבום', 'התגובות היו מפוצלות')
  assert.equal(d.was, 'לא קנו את האלבום')
  assert.equal(d.is, 'התגובות היו מפוצלות')
  assert.equal(d.narrowed, false)
})

test('diffAnswers: a pure deletion falls back to full strings', () => {
  // Narrowing here would leave one side empty, which reads as nothing changed.
  const d = diffAnswers('אני הלכתי לבית הספר', 'אני לבית הספר')
  assert.equal(d.narrowed, false)
  assert.equal(d.was, 'אני הלכתי לבית הספר')
})

test('diffAnswers: single differing words with no shared context stay whole', () => {
  const d = diffAnswers('שבו', 'אשר')
  assert.equal(d.was, 'שבו')
  assert.equal(d.is, 'אשר')
  assert.equal(d.narrowed, false)
})
