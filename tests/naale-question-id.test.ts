/**
 * Question identity is the workbook's own "<TopicNumber>_<QuestionNumber>" id
 * (e.g. 9_13), not the question text. Before this, both banks were keyed
 * `unique (topic, prompt)`, so editing a prompt inserted a new row and
 * stranded the old one — it happened once for real in `השלמת משפטים`.
 *
 * The workbook itself lives outside the repo (.claude/ is gitignored), so the
 * sheets here are built in memory: the point is the id wiring, not the content.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  NUMBER_COL,
  SHEET_READERS,
  TOPIC_NUMBERS,
  checkTopicNumber,
  questionIdFor,
} from '@/lib/naale/question-import'

const SENTENCE_COMPLETION = 'השלמת משפטים' // topic 7 — "sentence completion"

/** Same layout every real sheet uses: title row, blank row, header row, data. */
function workbookWith(sheetName: string, title: string, header: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([[title], [], header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return wb
}

function sentenceCompletionWorkbook(numbers: (string | number)[], title = '7. השלמת משפטים') {
  return workbookWith(
    SENTENCE_COMPLETION,
    title,
    [NUMBER_COL, 'משפט (עם חסר)', 'תשובה A', 'תשובה B', 'תשובה C', 'תשובה נכונה', 'הסבר לתשובה הנכונה', 'רמת קושי (1-5)'],
    numbers.map((n, i) => [n, `משפט מספר ${i + 1} _____`, 'הוא', 'הם', 'היא', 'B', 'כי הנושא ברבים', 3])
  )
}

test('questionIdFor composes <topic>_<number> from the workbook columns', () => {
  assert.equal(questionIdFor('סיפור בהמשכים', '13', 15), '9_13')
  assert.equal(questionIdFor(SENTENCE_COMPLETION, ' 1 ', 4), '7_1')
})

test('questionIdFor refuses to invent an id', () => {
  // Falling back to a generated id would quietly restore text-based identity,
  // which is the whole failure this column exists to end.
  assert.throws(() => questionIdFor(SENTENCE_COMPLETION, '', 4), /must be a positive integer/)
  assert.throws(() => questionIdFor(SENTENCE_COMPLETION, 'abc', 4), /must be a positive integer/)
  assert.throws(() => questionIdFor(SENTENCE_COMPLETION, '0', 4), /must be a positive integer/)
  assert.throws(() => questionIdFor('גיליון לא מוכר', '1', 4), /no topic number registered/)
})

test('every in-scope topic has a registered number', () => {
  for (const sheet of Object.keys(SHEET_READERS)) {
    assert.ok(TOPIC_NUMBERS[sheet] !== undefined, `${sheet} is imported but has no topic number`)
  }
})

test('a parsed sheet carries stable ids that survive a prompt edit', () => {
  const before = SHEET_READERS[SENTENCE_COMPLETION](sentenceCompletionWorkbook([1, 2, 3]), SENTENCE_COMPLETION)
  assert.deepEqual(before.map(q => q.question_id), ['7_1', '7_2', '7_3'])

  // Same sheet, question 2's wording corrected — the id must not move, since
  // that id is what the upsert key and a student's error report both use.
  const edited = sentenceCompletionWorkbook([1, 2, 3])
  const ws = edited.Sheets[SENTENCE_COMPLETION]
  ws['B5'] = { t: 's', v: 'ניסוח מתוקן לגמרי _____' } // row 5 = question 2 (title, blank, header, then data)
  const after = SHEET_READERS[SENTENCE_COMPLETION](edited, SENTENCE_COMPLETION)

  assert.notEqual(after[1].prompt, before[1].prompt, 'the edit should actually change the text')
  assert.equal(after[1].question_id, before[1].question_id)
})

test('a missing # column fails loudly instead of importing without ids', () => {
  const wb = workbookWith(
    SENTENCE_COMPLETION,
    '7. השלמת משפטים',
    ['משפט (עם חסר)', 'תשובה A', 'תשובה B', 'תשובה C', 'תשובה נכונה', 'הסבר לתשובה הנכונה', 'רמת קושי (1-5)'],
    [['משפט _____', 'הוא', 'הם', 'היא', 'B', 'הסבר', 3]]
  )
  assert.throws(() => SHEET_READERS[SENTENCE_COMPLETION](wb, SENTENCE_COMPLETION), /missing expected column "#"/)
})

test('checkTopicNumber flags a renumbered workbook rather than silently rewriting ids', () => {
  const anomalies: string[] = []
  checkTopicNumber(sentenceCompletionWorkbook([1], '7. השלמת משפטים'), SENTENCE_COMPLETION, anomalies)
  assert.deepEqual(anomalies, [])

  checkTopicNumber(sentenceCompletionWorkbook([1], '99. השלמת משפטים'), SENTENCE_COMPLETION, anomalies)
  assert.equal(anomalies.length, 1)
  assert.match(anomalies[0], /does not contain the registered topic number 7/)
})
