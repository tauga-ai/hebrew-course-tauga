/**
 * Parsing, validation, and insert-only-for-new-rows logic for the Debate &
 * Opinion Expression sheet (naale-debate-module). Structurally different
 * from question-import.ts / open-question-import.ts's readers: this sheet's
 * own "question_id" column already holds the final "debate_N" string (not a
 * bare "#" that questionIdFor() combines with a topic number), and its
 * answers are multi-turn, so they don't fit naale_open_answers' single-shot
 * shape either — hence a dedicated table pair and a dedicated importer
 * rather than folding into either existing pipeline.
 */
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildColumnMap } from './question-import'

export const HEADER_ROW_INDEX = 2
const DEBATE_TOPIC_NUMBER = 14
export const DEBATE_TOPIC = 'דיבייט הבעת דעה'

// Unlike every other sheet (buildColumnMap + a bare "#" column read via
// questionIdFor()), this sheet's own "question_id" column already holds the
// final "debate_N" string — read directly, never derived.
export const DEBATE_COL = {
  questionId: 'question_id',
  difficulty: 'רמת קושי (1-5)',
  subject: 'נושא',
  initialArgument: 'טענת פתיחה של ה-AI',
  connectors: 'מילות קישור נדרשות',
  rubric: 'רובריקת הערכה',
  maxTurns: 'מספר תורות מקסימלי',
} as const
const DEBATE_REQUIRED = Object.values(DEBATE_COL)

export interface DebateQuestionRow {
  question_id: string
  topic: string
  difficulty: number
  subject: string
  initial_ai_argument: string
  required_connectors: string
  expected_answer_rubric: string
  max_turns: number
  source_row: number
}

/** Inverse for question-export.ts — the trailing number in "debate_N", not a
 *  topic-number-prefixed one (numberFromQuestionId() in question-import.ts
 *  assumes "<topicNumber>_<n>", which this ID shape isn't). */
export function numberFromDebateId(question_id: string): number {
  const n = parseInt(question_id.split('_').pop() ?? '', 10)
  if (!Number.isInteger(n)) throw new Error(`debate question_id ${JSON.stringify(question_id)} has no trailing number`)
  return n
}

function readDebateSheet(wb: XLSX.WorkBook, sheetName: string): DebateQuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, DEBATE_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    // Filtered on `subject`, not `questionId` — the sheet's trailing
    // "Next free #: N" note row (added by question-export.ts's nextFreeNumber())
    // has text in the SAME column as question_id here (both are column A),
    // so filtering on question_id let that note row through as if it were
    // real data, which then threw on its blank difficulty — and since a
    // thrown error aborts .map() entirely, that silently discarded every
    // real row too, not just the note row. Every genuine data row has a
    // non-blank subject; the note row doesn't.
    .filter(row => String(row[col[DEBATE_COL.subject]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx
      const difficulty = parseInt(cell(DEBATE_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be 1-5, got ${JSON.stringify(cell(DEBATE_COL.difficulty))}`)
      }
      const maxTurns = parseInt(cell(DEBATE_COL.maxTurns), 10)
      if (maxTurns !== 1 && maxTurns !== 2) {
        throw new Error(`${sheetName} row ${sourceRow}: max_turns must be 1 or 2, got ${JSON.stringify(cell(DEBATE_COL.maxTurns))}`)
      }
      return {
        question_id: cell(DEBATE_COL.questionId),
        topic: sheetName,
        difficulty,
        subject: cell(DEBATE_COL.subject),
        initial_ai_argument: cell(DEBATE_COL.initialArgument),
        required_connectors: cell(DEBATE_COL.connectors),
        expected_answer_rubric: cell(DEBATE_COL.rubric),
        max_turns: maxTurns,
        source_row: sourceRow,
      }
    })
}

export interface DebateImportReport {
  summary: { topic: string; count: number; byLevel: Record<number, number> }
  anomalies: string[]
  skippedSheet: boolean
  orphans: { question_id: string }[]
  alreadyExists: { question_id: string }[]
  totalRows: number
  written: boolean
}

/** Mirrors runOpenQuestionImport()'s shape (insert-only-for-new-rows, report
 *  orphans/alreadyExists, one sheet's failure doesn't abort the whole
 *  import) — but keyed on question_id alone, since it's already a stable,
 *  globally unique string here (unlike naale_open_questions, which composes
 *  a compound key from topic + prompt because neither alone is unique
 *  there). */
export async function runDebateQuestionImport(
  wb: XLSX.WorkBook,
  db: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<DebateImportReport> {
  if (!wb.Sheets[DEBATE_TOPIC]) {
    return { summary: { topic: DEBATE_TOPIC, count: 0, byLevel: {} }, anomalies: [`Sheet not found: ${DEBATE_TOPIC}`], skippedSheet: true, orphans: [], alreadyExists: [], totalRows: 0, written: false }
  }

  const anomalies: string[] = []
  // Same check as question-import.ts's checkTopicNumber(), inlined rather
  // than shared — that helper looks up the expected number from
  // TOPIC_NUMBERS, which is scoped to sheets that importer itself reads.
  const titleRows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[DEBATE_TOPIC], { header: 1, defval: '' })
  const title = String(titleRows[0]?.[0] ?? '')
  if (!title.includes(`${DEBATE_TOPIC_NUMBER}.`)) {
    anomalies.push(`${DEBATE_TOPIC}: title row ${JSON.stringify(title.slice(0, 60))} does not contain the registered topic number ${DEBATE_TOPIC_NUMBER} — question ids may be wrong`)
  }

  let rows: DebateQuestionRow[]
  try {
    rows = readDebateSheet(wb, DEBATE_TOPIC)
  } catch (e) {
    anomalies.push(e instanceof Error ? e.message : `${DEBATE_TOPIC}: failed to parse`)
    rows = []
  }
  if (rows.length === 0) anomalies.push(`${DEBATE_TOPIC}: no question rows found`)

  const byLevel: Record<number, number> = {}
  for (let l = 1; l <= 5; l++) byLevel[l] = rows.filter(r => r.difficulty === l).length

  const { data: existing } = await db.from('naale_debate_questions').select('question_id')
  const existingIds = new Set((existing ?? []).map(r => r.question_id))
  const newRows = rows.filter(r => !existingIds.has(r.question_id))
  const alreadyExists = rows.filter(r => existingIds.has(r.question_id)).map(r => ({ question_id: r.question_id }))

  let written = false
  if (!opts.dryRun && newRows.length > 0) {
    // insert, not upsert — same reasoning as runQuestionImport()/
    // runOpenQuestionImport(): an existing row is left untouched rather than
    // silently reverted by a re-upload.
    const { error } = await db.from('naale_debate_questions').insert(newRows)
    if (error) throw new Error(`insert failed — ${error.message}`)
    written = true
  }

  const sheetIds = new Set(rows.map(r => r.question_id))
  const orphans = [...existingIds].filter(id => !sheetIds.has(id)).map(question_id => ({ question_id }))

  return { summary: { topic: DEBATE_TOPIC, count: rows.length, byLevel }, anomalies, skippedSheet: false, orphans, alreadyExists, totalRows: rows.length, written }
}
