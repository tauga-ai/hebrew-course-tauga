/**
 * Parsing, validation, and upsert logic for the Naale question-bank workbook
 * — shared by scripts/import-naale-questions.ts (CLI) and
 * /api/naale/admin/questions/import (web upload) so the two can never
 * silently diverge. Neither caller owns this logic; both are thin wrappers
 * that format runQuestionImport()'s report for their own medium (console
 * output vs. JSON).
 */
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

// Every registered sheet shares this layout: a title row, a blank row, THEN
// the header row — not row 1 like a plain spreadsheet. Confirmed against the
// delivered file for every sheet below.
const HEADER_ROW_INDEX = 2

/** The workbook's own per-question number — the first column of every topic
 *  sheet, per the workbook's own English guide sheet ("Every topic sheet has a
 *  "#" column first and a "Difficulty (1-5)" column last"). */
export const NUMBER_COL = '#'

/** Each topic sheet's number in the workbook — the first half of the spec's
 *  QUESTION_ID, "<TopicNumber>_<QuestionNumber>" (e.g. `9_13`).
 *
 *  Kept here rather than parsed from the sheet title because the titles aren't
 *  uniformly formatted: most start "9. ...", but `סיכום טקסט קצר` reads
 *  "... – 11. ..." with the number mid-string. runQuestionImport() still
 *  cross-checks each title against this map, so a renumbered workbook surfaces
 *  as an anomaly instead of silently rewriting every id. Numbers cover all 14
 *  topics, so the 7 in scope are deliberately non-contiguous. */
export const TOPIC_NUMBERS: Record<string, number> = {
  'הבנת הנקרא': 4,
  'נרדפות והופכיות': 6,
  'השלמת משפטים': 7,
  'תיקון משפטים': 8,
  'סיפור בהמשכים': 9,
  'ווטסאפ והודעות': 10,
  'סיכום טקסט קצר': 11,
}

/** "<TopicNumber>_<QuestionNumber>" for one row, e.g. `9_13`.
 *
 *  Throws rather than inventing an id: a missing or non-numeric `#` means the
 *  workbook changed shape, and generating a fallback id would quietly put the
 *  bank back on text-based identity — the exact failure this column exists to
 *  end. */
export function questionIdFor(sheetName: string, rawNumber: string, sourceRow: number): string {
  const topicNumber = TOPIC_NUMBERS[sheetName]
  if (topicNumber === undefined) {
    throw new Error(`${sheetName}: no topic number registered — add it to TOPIC_NUMBERS`)
  }
  const n = parseInt(String(rawNumber).trim(), 10)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${sheetName} row ${sourceRow}: "${NUMBER_COL}" must be a positive integer, got ${JSON.stringify(rawNumber)}`)
  }
  return `${topicNumber}_${n}`
}

/** Cross-checks a sheet's title row against TOPIC_NUMBERS. A workbook that
 *  renumbers its topics would otherwise change every question_id silently. */
export function checkTopicNumber(wb: XLSX.WorkBook, sheetName: string, anomalies: string[]): void {
  const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
  const title = String(rows[0]?.[0] ?? '')
  const expected = TOPIC_NUMBERS[sheetName]
  if (expected !== undefined && !title.includes(`${expected}.`)) {
    anomalies.push(`${sheetName}: title row ${JSON.stringify(title.slice(0, 60))} does not contain the registered topic number ${expected} — question ids may be wrong`)
  }
}

const SENTENCE_COMPLETION_COL = {
  num: NUMBER_COL,
  prompt: 'משפט (עם חסר)',
  answerA: 'תשובה A',
  answerB: 'תשובה B',
  answerC: 'תשובה C',
  correctLetter: 'תשובה נכונה',
  explanation: 'הסבר לתשובה הנכונה',
  difficulty: 'רמת קושי (1-5)',
} as const
const SENTENCE_COMPLETION_REQUIRED = Object.values(SENTENCE_COMPLETION_COL)
const SENTENCE_COMPLETION_LETTER_TO_COLUMN = {
  A: SENTENCE_COMPLETION_COL.answerA,
  B: SENTENCE_COMPLETION_COL.answerB,
  C: SENTENCE_COMPLETION_COL.answerC,
} as const

const SENTENCE_CORRECTION_COL = {
  num: NUMBER_COL,
  errorType: 'סוג השגיאה',
  brokenSentence: 'משפט שגוי',
  answerA: 'תשובה A',
  answerB: 'תשובה B',
  answerC: 'תשובה C',
  answerD: 'תשובה D',
  correctLetter: 'תשובה נכונה',
  difficulty: 'רמת קושי (1-5)',
} as const
const SENTENCE_CORRECTION_REQUIRED = Object.values(SENTENCE_CORRECTION_COL)
const SENTENCE_CORRECTION_LETTER_TO_COLUMN = {
  A: SENTENCE_CORRECTION_COL.answerA,
  B: SENTENCE_CORRECTION_COL.answerB,
  C: SENTENCE_CORRECTION_COL.answerC,
  D: SENTENCE_CORRECTION_COL.answerD,
} as const

const READING_COMPREHENSION_COL = {
  num: NUMBER_COL,
  passage: 'טקסט קצר',
  question: 'שאלה',
  answerA: 'תשובה A',
  answerB: 'תשובה B',
  answerC: 'תשובה C',
  answerD: 'תשובה D',
  correctLetter: 'תשובה נכונה',
  difficulty: 'רמת קושי (1-5)',
} as const
const READING_COMPREHENSION_REQUIRED = Object.values(READING_COMPREHENSION_COL)
const READING_COMPREHENSION_LETTER_TO_COLUMN = {
  A: READING_COMPREHENSION_COL.answerA,
  B: READING_COMPREHENSION_COL.answerB,
  C: READING_COMPREHENSION_COL.answerC,
  D: READING_COMPREHENSION_COL.answerD,
} as const

const SYNONYMS_ANTONYMS_COL = {
  num: NUMBER_COL,
  word: 'מילה',
  context: 'משפט הקשר',
  answerA: 'תשובה A',
  answerB: 'תשובה B',
  answerC: 'תשובה C',
  answerD: 'תשובה D',
  correctLetter: 'תשובה נכונה',
  difficulty: 'רמת קושי (1-5)',
} as const
const SYNONYMS_ANTONYMS_REQUIRED = Object.values(SYNONYMS_ANTONYMS_COL)
const SYNONYMS_ANTONYMS_LETTER_TO_COLUMN = {
  A: SYNONYMS_ANTONYMS_COL.answerA,
  B: SYNONYMS_ANTONYMS_COL.answerB,
  C: SYNONYMS_ANTONYMS_COL.answerC,
  D: SYNONYMS_ANTONYMS_COL.answerD,
} as const

const MIN_LEVEL = 1
const MAX_LEVEL = 5

interface QuestionRow {
  topic: string
  question_id: string
  difficulty: number
  prompt: string
  answer_kind: 'mcq'
  options: string[]
  correct_answer: string
  explanation: string
  source_row: number
}

/** Maps each required column name to its index in this sheet's own header
 *  row (not assumed to share a fixed position with any other sheet). */
/** Exported for reuse by open-question-import.ts's sheet readers — every
 *  open-response sheet needs this exact header-to-column-index mapping too. */
export function buildColumnMap(headerRow: string[], requiredColumns: string[], sheetName: string): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((name, i) => { map[name.trim()] = i })
  for (const col of requiredColumns) {
    if (!(col in map)) {
      // Lists what WAS found on the header row, not just what's missing —
      // a renamed/retyped column (vs. a genuinely absent one) looks
      // identical from "missing", so without this a future case of Yuval
      // slightly rewording a header reads as a mystery rather than an
      // obvious one-column mismatch.
      const found = headerRow.map(h => h.trim()).filter(Boolean).join(', ') || '(no headers found)'
      throw new Error(`${sheetName}: missing expected column "${col}" in header row — columns found instead: ${found}`)
    }
  }
  return map
}

function readSentenceCompletionSheet(wb: XLSX.WorkBook, sheetName: string): QuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, SENTENCE_COMPLETION_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    .filter(row => String(row[col[SENTENCE_COMPLETION_COL.prompt]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx // 1-based spreadsheet row number
      const question_id = questionIdFor(sheetName, cell(SENTENCE_COMPLETION_COL.num), sourceRow)

      const difficulty = parseInt(cell(SENTENCE_COMPLETION_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < MIN_LEVEL || difficulty > MAX_LEVEL) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be ${MIN_LEVEL}-${MAX_LEVEL}, got ${JSON.stringify(cell(SENTENCE_COMPLETION_COL.difficulty))}`)
      }

      const options = [cell(SENTENCE_COMPLETION_COL.answerA), cell(SENTENCE_COMPLETION_COL.answerB), cell(SENTENCE_COMPLETION_COL.answerC)].filter(Boolean)
      // A blank/invalid letter is a content smell (empty or malformed answer
      // key), not a structural parse failure — leave correct_answer empty and
      // let validate() flag it below, rather than aborting the whole import
      // over one bad row.
      const letter = cell(SENTENCE_COMPLETION_COL.correctLetter).toUpperCase()
      const correctColumn = SENTENCE_COMPLETION_LETTER_TO_COLUMN[letter as keyof typeof SENTENCE_COMPLETION_LETTER_TO_COLUMN]

      return {
        topic: sheetName,
        question_id,
        difficulty,
        prompt: cell(SENTENCE_COMPLETION_COL.prompt),
        answer_kind: 'mcq',
        options,
        correct_answer: correctColumn ? cell(correctColumn) : '',
        explanation: cell(SENTENCE_COMPLETION_COL.explanation),
        source_row: sourceRow,
      }
    })
}

/** Unlike שלמת משפטים's blank ("_____"), the broken sentence alone doesn't
 *  self-signal the task ("pick the corrected version below") — a fixed
 *  instruction line is prepended. Exact wording is a placeholder pending
 *  Yuval's sign-off; a one-line template change, not a re-import, to adjust. */
function readSentenceCorrectionSheet(wb: XLSX.WorkBook, sheetName: string): QuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, SENTENCE_CORRECTION_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    .filter(row => String(row[col[SENTENCE_CORRECTION_COL.brokenSentence]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx
      const question_id = questionIdFor(sheetName, cell(SENTENCE_CORRECTION_COL.num), sourceRow)

      const difficulty = parseInt(cell(SENTENCE_CORRECTION_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < MIN_LEVEL || difficulty > MAX_LEVEL) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be ${MIN_LEVEL}-${MAX_LEVEL}, got ${JSON.stringify(cell(SENTENCE_CORRECTION_COL.difficulty))}`)
      }

      const options = (['A', 'B', 'C', 'D'] as const)
        .map(l => cell(SENTENCE_CORRECTION_LETTER_TO_COLUMN[l]))
        .filter(Boolean)
      const letter = cell(SENTENCE_CORRECTION_COL.correctLetter).toUpperCase()
      const correctColumn = SENTENCE_CORRECTION_LETTER_TO_COLUMN[letter as keyof typeof SENTENCE_CORRECTION_LETTER_TO_COLUMN]

      return {
        topic: sheetName,
        question_id,
        difficulty,
        prompt: `תקן את המשפט הבא:\n${cell(SENTENCE_CORRECTION_COL.brokenSentence)}`,
        answer_kind: 'mcq',
        options,
        correct_answer: correctColumn ? cell(correctColumn) : '',
        explanation: '',
        source_row: sourceRow,
      }
    })
}

/** Passage + question already reads as a complete, self-explanatory prompt
 *  once shown as two lines (passage, blank line, question) — unlike sentence
 *  correction, no instruction text needs to be synthesized here. */
function readReadingComprehensionSheet(wb: XLSX.WorkBook, sheetName: string): QuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, READING_COMPREHENSION_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    .filter(row => String(row[col[READING_COMPREHENSION_COL.question]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx
      const question_id = questionIdFor(sheetName, cell(READING_COMPREHENSION_COL.num), sourceRow)

      const difficulty = parseInt(cell(READING_COMPREHENSION_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < MIN_LEVEL || difficulty > MAX_LEVEL) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be ${MIN_LEVEL}-${MAX_LEVEL}, got ${JSON.stringify(cell(READING_COMPREHENSION_COL.difficulty))}`)
      }

      const options = (['A', 'B', 'C', 'D'] as const)
        .map(l => cell(READING_COMPREHENSION_LETTER_TO_COLUMN[l]))
        .filter(Boolean)
      const letter = cell(READING_COMPREHENSION_COL.correctLetter).toUpperCase()
      const correctColumn = READING_COMPREHENSION_LETTER_TO_COLUMN[letter as keyof typeof READING_COMPREHENSION_LETTER_TO_COLUMN]

      return {
        topic: sheetName,
        question_id,
        difficulty,
        prompt: `${cell(READING_COMPREHENSION_COL.passage)}\n\n${cell(READING_COMPREHENSION_COL.question)}`,
        answer_kind: 'mcq',
        options,
        correct_answer: correctColumn ? cell(correctColumn) : '',
        explanation: '',
        source_row: sourceRow,
      }
    })
}

/** Each option is a (synonym, antonym) pair for `word`, not a single word —
 *  the workbook has no instructional sentence of its own, so one is
 *  synthesized here combining the word and its context sentence. Exact
 *  wording is a placeholder; confirm with Yuval (see task.md §1). */
function readSynonymsAntonymsSheet(wb: XLSX.WorkBook, sheetName: string): QuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, SYNONYMS_ANTONYMS_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    .filter(row => String(row[col[SYNONYMS_ANTONYMS_COL.word]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx
      const question_id = questionIdFor(sheetName, cell(SYNONYMS_ANTONYMS_COL.num), sourceRow)

      const difficulty = parseInt(cell(SYNONYMS_ANTONYMS_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < MIN_LEVEL || difficulty > MAX_LEVEL) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be ${MIN_LEVEL}-${MAX_LEVEL}, got ${JSON.stringify(cell(SYNONYMS_ANTONYMS_COL.difficulty))}`)
      }

      const options = (['A', 'B', 'C', 'D'] as const)
        .map(l => cell(SYNONYMS_ANTONYMS_LETTER_TO_COLUMN[l]))
        .filter(Boolean)
      const letter = cell(SYNONYMS_ANTONYMS_COL.correctLetter).toUpperCase()
      const correctColumn = SYNONYMS_ANTONYMS_LETTER_TO_COLUMN[letter as keyof typeof SYNONYMS_ANTONYMS_LETTER_TO_COLUMN]

      const word = cell(SYNONYMS_ANTONYMS_COL.word)
      const context = cell(SYNONYMS_ANTONYMS_COL.context)

      return {
        topic: sheetName,
        question_id,
        difficulty,
        prompt: `בחר את הזוג הנכון (מילה נרדפת, מילה הפכית) למילה "${word}" במשפט:\n"${context}"`,
        answer_kind: 'mcq',
        options,
        correct_answer: correctColumn ? cell(correctColumn) : '',
        explanation: '',
        source_row: sourceRow,
      }
    })
}

/** Every real-content sheet registered for import, keyed by its exact sheet
 *  name (which is also the topic key every session query matches on). Add a
 *  new entry here once a topic has real content, pairing it with a reader
 *  matching its own column layout. */
export const SHEET_READERS: Record<string, (wb: XLSX.WorkBook, sheetName: string) => QuestionRow[]> = {
  'השלמת משפטים': readSentenceCompletionSheet,
  'תיקון משפטים': readSentenceCorrectionSheet,
  'הבנת הנקרא': readReadingComprehensionSheet,
  'נרדפות והופכיות': readSynonymsAntonymsSheet,
}

function validate(topic: string, questions: QuestionRow[], anomalies: string[]) {
  if (questions.length === 0) {
    anomalies.push(`${topic}: no question rows found`)
    return
  }

  const byDifficulty = new Map<number, number>()
  const seenIds = new Set<string>()
  const seenPrompts = new Set<string>()

  for (const q of questions) {
    byDifficulty.set(q.difficulty, (byDifficulty.get(q.difficulty) ?? 0) + 1)

    if (!q.correct_answer) {
      anomalies.push(`${topic} row ${q.source_row}: empty or unrecognized correct-answer letter`)
    } else if (!q.options.includes(q.correct_answer)) {
      anomalies.push(`${topic} row ${q.source_row}: correct answer ${JSON.stringify(q.correct_answer)} is not one of the options`)
    }
    if (q.options.length < 2) {
      anomalies.push(`${topic} row ${q.source_row}: fewer than 2 answer options`)
    }
    if (/[…]|\.\.\.\s*$/.test(q.prompt)) {
      anomalies.push(`${topic} row ${q.source_row}: question ends with an ellipsis — likely truncated content in the source spreadsheet, not a parsing issue`)
    }
    if (seenIds.has(q.question_id)) {
      anomalies.push(`${topic} row ${q.source_row}: duplicate question id ${q.question_id} — the (topic, question_id) upsert key collapses these into one row`)
    }
    seenIds.add(q.question_id)
    // No longer collapses rows now that identity is the id, but two identical
    // questions in one topic is still a content problem worth surfacing.
    if (seenPrompts.has(q.prompt)) {
      anomalies.push(`${topic} row ${q.source_row}: duplicate question text (id ${q.question_id}) — same wording as an earlier row in this sheet`)
    }
    seenPrompts.add(q.prompt)
  }

  // 2-3 questions per level is the whole reason the scale moved from 1-10 to
  // 1-5. A level with nothing in it means a student who reaches it
  // immediately hits the "topic finished for today" fallback.
  for (let level = MIN_LEVEL; level <= MAX_LEVEL; level++) {
    if (!byDifficulty.has(level)) {
      anomalies.push(`${topic}: NO questions at difficulty ${level} — students reaching this level will hit the exhausted-topic fallback immediately`)
    }
  }
}

export interface QuestionImportReport {
  summary: { topic: string; count: number; byLevel: Record<number, number> }[]
  anomalies: string[]
  skippedSheets: string[]
  orphans: { topic: string; question_id: string; prompt: string }[]
  totalRows: number
  written: boolean
}

/**
 * Parses, validates, and (unless dryRun) upserts every registered sheet from
 * `wb`. Shared by scripts/import-naale-questions.ts (CLI) and
 * /api/naale/admin/questions/import (web upload) so the two never diverge.
 */
export async function runQuestionImport(
  wb: XLSX.WorkBook,
  db: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<QuestionImportReport> {
  const anomalies: string[] = []
  const summary: QuestionImportReport['summary'] = []
  const allRows: QuestionRow[] = []

  for (const [sheetName, readSheet] of Object.entries(SHEET_READERS)) {
    if (!wb.Sheets[sheetName]) {
      anomalies.push(`Sheet not found in workbook: ${sheetName}`)
      continue
    }
    // A single sheet's structural problem (missing column, bad difficulty
    // value) must not take down the whole import — the other sheets may be
    // fine, and the CLI's "no anomalies → no partial state" guarantee only
    // holds if a break in one sheet still surfaces as a reported anomaly
    // rather than an uncaught crash that skips reporting on everything else.
    checkTopicNumber(wb, sheetName, anomalies)

    let questions: QuestionRow[]
    try {
      questions = readSheet(wb, sheetName)
    } catch (e) {
      anomalies.push(e instanceof Error ? e.message : `${sheetName}: failed to parse (unknown error)`)
      continue
    }
    validate(sheetName, questions, anomalies)
    allRows.push(...questions)

    const byLevel: Record<number, number> = {}
    for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) byLevel[l] = questions.filter(q => q.difficulty === l).length
    summary.push({ topic: sheetName, count: questions.length, byLevel })
  }

  const expectedSheets = Object.keys(SHEET_READERS)
  const skippedSheets = wb.SheetNames.filter(n => !expectedSheets.includes(n))

  let written = false
  if (!opts.dryRun && allRows.length > 0) {
    const { error } = await db.from('naale_questions').upsert(allRows, { onConflict: 'topic,question_id' })
    if (error) throw new Error(`upsert failed — ${error.message}`)
    written = true
  }

  // Reported, never deleted — scoped to registered sheets so rows seeded for
  // not-yet-imported topics aren't flagged as orphans of a workbook that
  // never covered them. Read even on a dry run so the preview shows the same
  // information a real run's console output would.
  const { data: existing } = await db
    .from('naale_questions')
    .select('topic, question_id, prompt')
    .in('topic', expectedSheets)
  const workbookKeys = new Set(allRows.map(r => `${r.topic} ${r.question_id}`))
  const orphans = (existing ?? [])
    .filter(r => !workbookKeys.has(`${r.topic} ${r.question_id}`))
    .map(r => ({ topic: r.topic, question_id: r.question_id, prompt: r.prompt }))

  return { summary, anomalies, skippedSheets, orphans, totalRows: allRows.length, written }
}
