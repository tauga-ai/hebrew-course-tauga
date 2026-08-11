/**
 * Imports the "השלמת משפטים" (sentence completion) sheet from Yuval's Naale
 * question workbook into the naale_questions table.
 *
 * Scope: this is the ONLY sheet with real, complete content today — the
 * other 6 in-scope topics are 3-row examples with no difficulty ratings, and
 * 3 of the deferred/incomplete topics (story continuation, WhatsApp
 * messages, short-text summary) have no fixed correct answer at all (open
 * writing tasks needing AI grading — out of scope for this script). Per the
 * addendum in .claude/requirements/naale-hebrew-track-tasks.md, the adaptive
 * engine is being built against sentence completion only for the demo.
 * Adding more topics later needs zero code changes beyond appending to
 * EXPECTED_SHEETS, PROVIDED the new sheet shares this exact column layout
 * (sentence + 3 lettered options + a correct-answer letter + difficulty). A
 * sheet with a different layout (free text, no correct answer, "whole row is
 * the answer key") needs its own reader function first — see the workbook's
 * own "Example (EN) - DO NOT IMPORT" guide sheet for the other patterns.
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

/** The sheet name IS the topic key — every session query matches on this
 *  exact string. Only one sheet today; see the header comment for why. */
const EXPECTED_SHEETS = ['השלמת משפטים']

// This sheet's real layout: a title row, a blank row, THEN the header row —
// not row 1 like a plain spreadsheet. Confirmed against the delivered file.
const HEADER_ROW_INDEX = 2

const COL = {
  prompt: 'משפט (עם חסר)',
  answerA: 'תשובה A',
  answerB: 'תשובה B',
  answerC: 'תשובה C',
  correctLetter: 'תשובה נכונה',
  difficulty: 'רמת קושי (1-5)',
} as const
const REQUIRED_COLUMNS = Object.values(COL)
const LETTER_TO_COLUMN = { A: COL.answerA, B: COL.answerB, C: COL.answerC } as const

const MIN_LEVEL = 1
const MAX_LEVEL = 5

interface QuestionRow {
  topic: string
  difficulty: number
  prompt: string
  answer_kind: 'mcq'
  options: string[]
  correct_answer: string
  source_row: number
}

/** Maps each required column name to its index in this sheet's own header
 *  row (not assumed to share a fixed position with any other sheet). */
function buildColumnMap(headerRow: string[], sheetName: string): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((name, i) => { map[name.trim()] = i })
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in map)) throw new Error(`${sheetName}: missing expected column "${col}" in header row`)
  }
  return map
}

function readSheet(wb: XLSX.WorkBook, sheetName: string): QuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    .filter(row => String(row[col[COL.prompt]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx // 1-based spreadsheet row number

      const difficulty = parseInt(cell(COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < MIN_LEVEL || difficulty > MAX_LEVEL) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be ${MIN_LEVEL}-${MAX_LEVEL}, got ${JSON.stringify(cell(COL.difficulty))}`)
      }

      const options = [cell(COL.answerA), cell(COL.answerB), cell(COL.answerC)].filter(Boolean)
      // A blank/invalid letter is a content smell (empty or malformed answer
      // key), not a structural parse failure — leave correct_answer empty and
      // let validate() flag it below, rather than aborting the whole import
      // over one bad row.
      const letter = cell(COL.correctLetter).toUpperCase()
      const correctColumn = LETTER_TO_COLUMN[letter as keyof typeof LETTER_TO_COLUMN]

      return {
        topic: sheetName,
        difficulty,
        prompt: cell(COL.prompt),
        answer_kind: 'mcq',
        options,
        correct_answer: correctColumn ? cell(correctColumn) : '',
        source_row: sourceRow,
      }
    })
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

  for (const sheetName of EXPECTED_SHEETS) {
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

  const unexpected = wb.SheetNames.filter(n => !EXPECTED_SHEETS.includes(n))
  if (unexpected.length > 0) {
    console.log(`Skipping ${unexpected.length} sheet(s) not in EXPECTED_SHEETS (expected — see header comment): ${unexpected.join(', ')}`)
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

  // Reported, never deleted — see the header comment. Scoped to
  // EXPECTED_SHEETS so rows seeded for other (not-yet-imported) topics don't
  // get flagged as orphans of a workbook that never covered them.
  const { data: existing } = await db
    .from('naale_questions')
    .select('topic, prompt')
    .in('topic', EXPECTED_SHEETS)
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
