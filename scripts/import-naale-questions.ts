/**
 * Imports real-content sheets from Yuval's Naale question workbook into the
 * naale_questions table. Each sheet is registered in SHEET_READERS below with
 * its own reader function, since sheets vary in column layout (different
 * option counts, different prompt shapes) — see the workbook's own
 * "Example (EN) - DO NOT IMPORT" guide sheet for the full set of patterns.
 * Sheets without real content yet (3-row examples, no difficulty ratings) or
 * needing AI grading (open writing tasks with no fixed correct answer) are
 * intentionally not registered here.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/import-naale-questions.ts <path-to-xlsx> [--dry-run]
 *
 * Unlike scripts/convert-makbatzim.ts and scripts/convert-tzav-rishon.ts,
 * which write static JSON under src/data/, this writes DB rows: the session
 * engine queries by (topic, difficulty, not-yet-seen-by-this-student) on
 * every answer, which a build-time static import cannot serve.
 *
 * Idempotent: upserts on (topic, prompt), the unique constraint from
 * ticket 1. naale_answers.question_id is a FK to naale_questions.id, so
 * re-importing must preserve ids rather than delete-and-reinsert — that's
 * what upsert on a stable key does, and it's why editing a question's TEXT
 * creates a new row instead of updating the old one (the old text is part of
 * the key). The old row is reported as an orphan below rather than deleted —
 * deleting a question a student has already answered would orphan/block on
 * their answer rows.
 *
 * This script never deletes. A question dropped from a later workbook stays
 * in the table; such rows are reported at the end for a human to act on.
 */
import * as XLSX from 'xlsx'
import { createServiceClient } from '../src/lib/supabase/service'

// Every registered sheet shares this layout: a title row, a blank row, THEN
// the header row — not row 1 like a plain spreadsheet. Confirmed against the
// delivered file for every sheet below.
const HEADER_ROW_INDEX = 2

const SENTENCE_COMPLETION_COL = {
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

const MIN_LEVEL = 1
const MAX_LEVEL = 5

interface QuestionRow {
  topic: string
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
function buildColumnMap(headerRow: string[], requiredColumns: string[], sheetName: string): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((name, i) => { map[name.trim()] = i })
  for (const col of requiredColumns) {
    if (!(col in map)) throw new Error(`${sheetName}: missing expected column "${col}" in header row`)
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

/** Every real-content sheet registered for import, keyed by its exact sheet
 *  name (which is also the topic key every session query matches on). Add a
 *  new entry here once a topic has real content, pairing it with a reader
 *  matching its own column layout. */
const SHEET_READERS: Record<string, (wb: XLSX.WorkBook, sheetName: string) => QuestionRow[]> = {
  'השלמת משפטים': readSentenceCompletionSheet,
  'תיקון משפטים': readSentenceCorrectionSheet,
  'הבנת הנקרא': readReadingComprehensionSheet,
}

function validate(topic: string, questions: QuestionRow[], anomalies: string[]) {
  if (questions.length === 0) {
    anomalies.push(`${topic}: no question rows found`)
    return
  }

  const byDifficulty = new Map<number, number>()
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
    if (seenPrompts.has(q.prompt)) {
      anomalies.push(`${topic} row ${q.source_row}: duplicate question text — the (topic, prompt) upsert key collapses these into one row`)
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

async function main() {
  const xlsxPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!xlsxPath) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/import-naale-questions.ts <path-to-xlsx> [--dry-run]')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath)
  const db = createServiceClient()
  const anomalies: string[] = []
  const summary: { topic: string; count: number; byLevel: string }[] = []
  const allRows: QuestionRow[] = []

  for (const [sheetName, readSheet] of Object.entries(SHEET_READERS)) {
    if (!wb.Sheets[sheetName]) {
      anomalies.push(`Sheet not found in workbook: ${sheetName}`)
      continue
    }
    const questions = readSheet(wb, sheetName)
    validate(sheetName, questions, anomalies)
    allRows.push(...questions)

    const byLevel = [1, 2, 3, 4, 5]
      .map(l => `L${l}:${questions.filter(q => q.difficulty === l).length}`)
      .join(' ')
    summary.push({ topic: sheetName, count: questions.length, byLevel })
  }

  const expectedSheets = Object.keys(SHEET_READERS)
  const unexpected = wb.SheetNames.filter(n => !expectedSheets.includes(n))
  if (unexpected.length > 0) {
    console.log(`Skipping ${unexpected.length} sheet(s) not registered in SHEET_READERS (expected — see header comment): ${unexpected.join(', ')}`)
  }

  console.log('Parsed:')
  for (const s of summary) console.log(`  ${s.topic}: ${s.count} questions (${s.byLevel})`)

  if (!dryRun && allRows.length > 0) {
    const { error } = await db
      .from('naale_questions')
      .upsert(allRows, { onConflict: 'topic,prompt' })
    if (error) throw new Error(`upsert failed — ${error.message}`)
    console.log(`\n${allRows.length} questions upserted into naale_questions.`)
  } else if (dryRun) {
    console.log('\n--dry-run: nothing written.')
  }

  // Reported, never deleted — see the header comment. Scoped to the
  // registered sheets so rows seeded for other (not-yet-imported) topics
  // don't get flagged as orphans of a workbook that never covered them.
  const { data: existing } = await db
    .from('naale_questions')
    .select('topic, prompt')
    .in('topic', expectedSheets)
  const workbookKeys = new Set(allRows.map(r => `${r.topic} ${r.prompt}`))
  const orphans = (existing ?? []).filter(r => !workbookKeys.has(`${r.topic} ${r.prompt}`))
  if (orphans.length > 0) {
    console.log(`\n${orphans.length} questions in the table are NOT in this workbook (left untouched):`)
    for (const o of orphans.slice(0, 20)) console.log(`  - [${o.topic}] ${o.prompt.slice(0, 60)}...`)
    if (orphans.length > 20) console.log(`  ... and ${orphans.length - 20} more`)
  }

  if (anomalies.length > 0) {
    console.log(`\n${anomalies.length} anomalies found:`)
    for (const a of anomalies) console.log(`  - ${a}`)
    process.exitCode = 1
  } else {
    console.log('\nNo anomalies found in automated validation pass.')
  }
}

main()
