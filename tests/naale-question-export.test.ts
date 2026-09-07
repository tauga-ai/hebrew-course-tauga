/**
 * Round-trip coverage for naale-question-bank-excel-export: build a workbook
 * from known DB-shaped rows, serialize it exactly like the real export route
 * does (exceljs), then parse that buffer back through the *actual*,
 * unmodified sheet readers question-import.ts / open-question-import.ts
 * already use for real uploads (xlsx) — proving a real write+read cycle
 * regenerates byte-identical content on re-import, not just that a file
 * gets produced. Two different libraries write vs. read this file on
 * purpose (see question-export.ts's file header) — this round trip is what
 * actually proves they agree on the format.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import type ExcelJS from 'exceljs'
import { SHEET_READERS } from '@/lib/naale/question-import'
import { OPEN_SHEET_READERS } from '@/lib/naale/open-question-import'
import { buildQuestionBankWorkbook, nextFreeNumber, type ExportQuestionRow, type ExportOpenQuestionRow } from '@/lib/naale/question-export'

async function toXlsxWorkbook(wb: ExcelJS.Workbook): Promise<XLSX.WorkBook> {
  const buffer = await wb.xlsx.writeBuffer()
  return XLSX.read(buffer, { type: 'buffer' })
}

const MCQ_ROWS: ExportQuestionRow[] = [
  {
    topic: 'השלמת משפטים', question_id: '7_1', difficulty: 3,
    prompt: 'משפט מספר 1 _____', options: ['הוא', 'הם', 'היא'], correct_answer: 'הם', explanation: 'כי הנושא ברבים',
  },
  {
    topic: 'תיקון משפטים', question_id: '8_5', difficulty: 2,
    prompt: 'תקן את המשפט הבא:\nהילד הולכים לבית ספר', options: ['א', 'ב', 'ג', 'ד'], correct_answer: 'ג', explanation: 'התאמת יחיד/רבים',
  },
  {
    topic: 'הבנת הנקרא', question_id: '4_2', difficulty: 4,
    prompt: 'זהו טקסט קצר לדוגמה.\n\nמה קרה בטקסט?', options: ['תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4'], correct_answer: 'תשובה 4', explanation: 'לפי הפסקה השנייה',
  },
  {
    topic: 'נרדפות והופכיות', question_id: '6_3', difficulty: 2,
    prompt: 'בחר את המילה הנרדפת למילה "שמח" במשפט:\n"הוא הרגיש שמח מאוד"', options: ['עצוב', 'עליז', 'כועס', 'עייף'], correct_answer: 'עליז', explanation: 'שמח = עליז',
  },
  {
    topic: 'נרדפות והופכיות', question_id: '6_4', difficulty: 5,
    prompt: 'בחר את הזוג הנכון (מילה נרדפת, מילה הפכית) למילה "גדול" במשפט:\n"הבית הזה גדול"', options: ['ענק/קטן', 'יפה/מכוער', 'חדש/ישן', 'רחוק/קרוב'], correct_answer: 'ענק/קטן', explanation: 'גדול-ענק (נרדפת), גדול-קטן (הפכית)',
  },
]

const OPEN_ROWS: ExportOpenQuestionRow[] = [
  {
    topic: 'סיפור בהמשכים', question_id: '9_1', difficulty: 1,
    prompt: 'פתאום שמענו רעש מוזר מהחצר.',
    fields: { student_task: 'המשך את הסיפור בשתי משפטים', mandatory_word: 'רעש' },
  },
  {
    topic: 'ווטסאפ והודעות', question_id: '10_1', difficulty: 2,
    prompt: 'כתוב הודעה שמסבירה שתאחר ב-10 דקות',
    fields: { recipient: 'המורה', expected_phrasing: 'מנומס ותמציתי' },
  },
  {
    topic: 'סיכום טקסט קצר', question_id: '11_1', difficulty: 3,
    prompt: 'פסקה קצרה על טיול לבית ספר.',
    fields: { student_task: 'סכם בשתי שורות', expected_summary: 'הכיתה יצאה לטיול' },
  },
  {
    topic: 'תיאור תמונה בקול', question_id: '12_1', difficulty: 1,
    prompt: 'תאר את מה שאתה רואה בתמונה',
    fields: { image_description: 'ילד משחק בכדור בפארק', mandatory_anchors: 'ילד,כדור', optional_anchors: 'פארק' },
  },
]

test('nextFreeNumber: 1 when a topic has no existing questions, max+1 otherwise', () => {
  assert.equal(nextFreeNumber('השלמת משפטים', []), 1)
  assert.equal(nextFreeNumber('השלמת משפטים', ['7_1', '7_3', '7_2']), 4)
})

test('round trip: every MCQ topic parses back to the same content it was built from', async () => {
  const wb = await toXlsxWorkbook(buildQuestionBankWorkbook(MCQ_ROWS, []))
  for (const row of MCQ_ROWS) {
    const parsed = SHEET_READERS[row.topic](wb, row.topic).find(q => q.question_id === row.question_id)
    assert.ok(parsed, `${row.topic} ${row.question_id} did not round-trip at all`)
    assert.equal(parsed!.prompt, row.prompt, `${row.question_id}: prompt`)
    assert.deepEqual(parsed!.options, row.options, `${row.question_id}: options`)
    assert.equal(parsed!.correct_answer, row.correct_answer, `${row.question_id}: correct_answer`)
    assert.equal(parsed!.explanation, row.explanation, `${row.question_id}: explanation`)
    assert.equal(parsed!.difficulty, row.difficulty, `${row.question_id}: difficulty`)
  }
})

test('round trip: every open topic parses back to the same content it was built from', async () => {
  const wb = await toXlsxWorkbook(buildQuestionBankWorkbook([], OPEN_ROWS))
  for (const row of OPEN_ROWS) {
    const parsed = OPEN_SHEET_READERS[row.topic](wb, row.topic).find(q => q.question_id === row.question_id)
    assert.ok(parsed, `${row.topic} ${row.question_id} did not round-trip at all`)
    assert.equal(parsed!.prompt, row.prompt, `${row.question_id}: prompt`)
    assert.equal(parsed!.difficulty, row.difficulty, `${row.question_id}: difficulty`)
    for (const [key, value] of Object.entries(row.fields)) {
      assert.equal(parsed!.fields[key], value, `${row.question_id}: fields.${key}`)
    }
  }
})

test('rows land sorted by "#", regardless of the order the DB rows arrive in', async () => {
  // selectAll() has no ORDER BY — rows can arrive in whatever order Postgres
  // returns them (import-batch order, not numeric order). Deliberately fed
  // in scrambled here to catch a regression a naive round-trip test (which
  // only checks each row survives, not the order) would miss.
  const scrambled: ExportQuestionRow[] = [
    { ...MCQ_ROWS[0], question_id: '7_5' },
    { ...MCQ_ROWS[0], question_id: '7_1' },
    { ...MCQ_ROWS[0], question_id: '7_3' },
  ]
  const wb = await toXlsxWorkbook(buildQuestionBankWorkbook(scrambled, []))
  const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets['השלמת משפטים'], { header: 1, defval: '' })
  const dataRows = rows.slice(3, 3 + scrambled.length)
  assert.deepEqual(dataRows.map(r => r[0]), ['1', '3', '5'])
})

test('round trip: the trailing "next free #" note row is silently skipped, not imported as a question', async () => {
  const wb = await toXlsxWorkbook(buildQuestionBankWorkbook(MCQ_ROWS, OPEN_ROWS))
  const parsedCompletion = SHEET_READERS['השלמת משפטים'](wb, 'השלמת משפטים')
  assert.equal(parsedCompletion.length, MCQ_ROWS.filter(r => r.topic === 'השלמת משפטים').length)
  const parsedStory = OPEN_SHEET_READERS['סיפור בהמשכים'](wb, 'סיפור בהמשכים')
  assert.equal(parsedStory.length, OPEN_ROWS.filter(r => r.topic === 'סיפור בהמשכים').length)
})

test('header row is visibly styled — colored fill and bold white text', async () => {
  const wb = buildQuestionBankWorkbook(MCQ_ROWS, [])
  const ws = wb.getWorksheet('השלמת משפטים')!
  const headerCell = ws.getRow(3).getCell(1)
  assert.equal((headerCell.fill as ExcelJS.FillPattern).fgColor?.argb, 'FF1F4E78')
  assert.equal(headerCell.font?.bold, true)
  assert.equal(headerCell.font?.color?.argb, 'FFFFFFFF')
})
