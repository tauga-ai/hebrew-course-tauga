/**
 * Parsing, validation, and insert-only-for-new-rows logic for the Role-play
 * in Everyday Situations sheet (naale-roleplay-module). Same structure as
 * debate-question-import.ts: this sheet's own "question_id" column already
 * holds the final "roleplay_N" string (not a bare "#" that questionIdFor()
 * combines with a topic number), and its answers are multi-turn, so they
 * don't fit naale_open_answers' single-shot shape either — hence a dedicated
 * table pair and a dedicated importer rather than folding into either
 * existing pipeline.
 */
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildColumnMap } from './question-import'

export const HEADER_ROW_INDEX = 2
const ROLEPLAY_TOPIC_NUMBER = 13
export const ROLEPLAY_TOPIC = 'משחק תפקידים'

// Unlike every other sheet (buildColumnMap + a bare "#" column read via
// questionIdFor()), this sheet's own "question_id" column already holds the
// final "roleplay_N" string — read directly, never derived.
export const ROLEPLAY_COL = {
  questionId: 'question_id',
  difficulty: 'רמת קושי (1-5)',
  scenario: 'תיאור הסיטואציה',
  persona: 'דמות ה-AI',
  initialLine: 'שורת פתיחה (AI)',
  goalAndRegister: 'מטרה ורובריקת הערכה',
  maxTurns: 'מספר תורות מקסימלי',
} as const
const ROLEPLAY_REQUIRED = Object.values(ROLEPLAY_COL)

export interface RoleplayQuestionRow {
  question_id: string
  topic: string
  difficulty: number
  scenario_description: string
  ai_persona: string
  initial_ai_line: string
  expected_goal_and_register: string
  max_turns: number
  source_row: number
}

/** Inverse for question-export.ts — the trailing number in "roleplay_N", not
 *  a topic-number-prefixed one (numberFromQuestionId() in question-import.ts
 *  assumes "<topicNumber>_<n>", which this ID shape isn't). Same shape as
 *  debate-question-import.ts's numberFromDebateId(). */
export function numberFromRoleplayId(question_id: string): number {
  const n = parseInt(question_id.split('_').pop() ?? '', 10)
  if (!Number.isInteger(n)) throw new Error(`roleplay question_id ${JSON.stringify(question_id)} has no trailing number`)
  return n
}

function readRoleplaySheet(wb: XLSX.WorkBook, sheetName: string): RoleplayQuestionRow[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const header = (rows[HEADER_ROW_INDEX] ?? []).map(c => String(c ?? ''))
  const col = buildColumnMap(header, ROLEPLAY_REQUIRED, sheetName)
  const dataRows = rows.slice(HEADER_ROW_INDEX + 1)

  return dataRows
    // Filtered on `scenario`, not `questionId` — same reasoning as debate's
    // reader: the sheet's trailing "Next free #: N" note row (added by
    // question-export.ts's nextFreeNumber()) has text in the SAME column as
    // question_id here (both are column A), so filtering on question_id let
    // that note row through as if it were real data, then threw on its blank
    // difficulty — and a thrown error aborts .map() entirely, silently
    // discarding every real row too. Every genuine data row has a non-blank
    // scenario_description; the note row doesn't.
    .filter(row => String(row[col[ROLEPLAY_COL.scenario]] ?? '').trim() !== '')
    .map((row, idx) => {
      const cell = (name: string) => String(row[col[name]] ?? '').trim()
      const sourceRow = HEADER_ROW_INDEX + 2 + idx
      const difficulty = parseInt(cell(ROLEPLAY_COL.difficulty), 10)
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        throw new Error(`${sheetName} row ${sourceRow}: difficulty must be 1-5, got ${JSON.stringify(cell(ROLEPLAY_COL.difficulty))}`)
      }
      const maxTurns = parseInt(cell(ROLEPLAY_COL.maxTurns), 10)
      if (maxTurns !== 1 && maxTurns !== 2) {
        throw new Error(`${sheetName} row ${sourceRow}: max_turns must be 1 or 2, got ${JSON.stringify(cell(ROLEPLAY_COL.maxTurns))}`)
      }
      return {
        question_id: cell(ROLEPLAY_COL.questionId),
        topic: sheetName,
        difficulty,
        scenario_description: cell(ROLEPLAY_COL.scenario),
        ai_persona: cell(ROLEPLAY_COL.persona),
        initial_ai_line: cell(ROLEPLAY_COL.initialLine),
        expected_goal_and_register: cell(ROLEPLAY_COL.goalAndRegister),
        max_turns: maxTurns,
        source_row: sourceRow,
      }
    })
}

export interface RoleplayImportReport {
  summary: { topic: string; count: number; byLevel: Record<number, number> }
  anomalies: string[]
  skippedSheet: boolean
  orphans: { question_id: string }[]
  alreadyExists: { question_id: string }[]
  totalRows: number
  written: boolean
}

/** Mirrors runDebateQuestionImport()'s shape (insert-only-for-new-rows,
 *  report orphans/alreadyExists, keyed on question_id alone since it's
 *  already a stable, globally unique string in this sheet too). */
export async function runRoleplayQuestionImport(
  wb: XLSX.WorkBook,
  db: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<RoleplayImportReport> {
  if (!wb.Sheets[ROLEPLAY_TOPIC]) {
    return { summary: { topic: ROLEPLAY_TOPIC, count: 0, byLevel: {} }, anomalies: [`Sheet not found: ${ROLEPLAY_TOPIC}`], skippedSheet: true, orphans: [], alreadyExists: [], totalRows: 0, written: false }
  }

  const anomalies: string[] = []
  const titleRows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[ROLEPLAY_TOPIC], { header: 1, defval: '' })
  const title = String(titleRows[0]?.[0] ?? '')
  if (!title.includes(`${ROLEPLAY_TOPIC_NUMBER}.`)) {
    anomalies.push(`${ROLEPLAY_TOPIC}: title row ${JSON.stringify(title.slice(0, 60))} does not contain the registered topic number ${ROLEPLAY_TOPIC_NUMBER} — question ids may be wrong`)
  }

  let rows: RoleplayQuestionRow[]
  try {
    rows = readRoleplaySheet(wb, ROLEPLAY_TOPIC)
  } catch (e) {
    anomalies.push(e instanceof Error ? e.message : `${ROLEPLAY_TOPIC}: failed to parse`)
    rows = []
  }
  if (rows.length === 0) anomalies.push(`${ROLEPLAY_TOPIC}: no question rows found`)

  const byLevel: Record<number, number> = {}
  for (let l = 1; l <= 5; l++) byLevel[l] = rows.filter(r => r.difficulty === l).length

  const { data: existing } = await db.from('naale_roleplay_questions').select('question_id')
  const existingIds = new Set((existing ?? []).map(r => r.question_id))
  const newRows = rows.filter(r => !existingIds.has(r.question_id))
  const alreadyExists = rows.filter(r => existingIds.has(r.question_id)).map(r => ({ question_id: r.question_id }))

  let written = false
  if (!opts.dryRun && newRows.length > 0) {
    // insert, not upsert — same reasoning as every other importer: an
    // existing row is left untouched rather than silently reverted by a
    // re-upload.
    const { error } = await db.from('naale_roleplay_questions').insert(newRows)
    if (error) throw new Error(`insert failed — ${error.message}`)
    written = true
  }

  const sheetIds = new Set(rows.map(r => r.question_id))
  const orphans = [...existingIds].filter(id => !sheetIds.has(id)).map(question_id => ({ question_id }))

  return { summary: { topic: ROLEPLAY_TOPIC, count: rows.length, byLevel }, anomalies, skippedSheet: false, orphans, alreadyExists, totalRows: rows.length, written }
}
