/**
 * Parsing and upsert logic for the Naale roster (email + role), shared by
 * scripts/import-naale-roster.ts (CLI) and /api/naale/admin/roster/import
 * (web upload). Accepts a CSV or an Excel file — the real school-provided
 * file's exact format wasn't confirmed at the time this was written, so both
 * are supported rather than guessed.
 *
 * Unlike question-import.ts's per-sheet fault tolerance, this is
 * deliberately all-or-nothing: naale_roster is the access-control list
 * itself, so ANY malformed row blocks the entire import, never just that row.
 */
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

export type NaaleRosterRole = 'student' | 'staff'
const VALID_ROLES: NaaleRosterRole[] = ['student', 'staff']

interface ParsedRow {
  email: string
  role: NaaleRosterRole
  line: number
}

interface ParseResult {
  rows: ParsedRow[]
  errors: string[]
}

/** Shared row-level validation, regardless of source format — a valid row is
 *  exactly [email, role], nothing more or less. */
function validateRows(rawRows: string[][]): ParseResult {
  const rows: ParsedRow[] = []
  const errors: string[] = []
  const seen = new Map<string, number>()

  rawRows.forEach((fields, idx) => {
    const line = idx + 1
    const trimmed = fields.map(f => String(f ?? '').trim())
    if (trimmed.every(f => f === '')) return // blank row, skip silently

    // Tolerate a header row, but only if it actually looks like one.
    if (idx === 0 && trimmed[0]?.toLowerCase() === 'email') return

    if (trimmed.length !== 2) {
      errors.push(`line ${line}: expected 2 fields (email,role), got ${trimmed.length}: ${JSON.stringify(trimmed)}`)
      return
    }

    const [email, role] = trimmed
    const normalizedEmail = email.toLowerCase()

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      errors.push(`line ${line}: not a valid email: ${JSON.stringify(email)}`)
      return
    }
    if (!VALID_ROLES.includes(role as NaaleRosterRole)) {
      errors.push(`line ${line}: role must be one of ${VALID_ROLES.join('/')}, got ${JSON.stringify(role)}`)
      return
    }
    const previous = seen.get(normalizedEmail)
    if (previous !== undefined) {
      errors.push(`line ${line}: duplicate email, already on line ${previous}: ${normalizedEmail}`)
      return
    }

    seen.set(normalizedEmail, line)
    rows.push({ email: normalizedEmail, role: role as NaaleRosterRole, line })
  })

  return { rows, errors }
}

function parseCsv(text: string): ParseResult {
  const rows = text.split(/\r?\n/).map(line => line.split(','))
  return validateRows(rows)
}

function parseXlsx(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return validateRows(rows.map(r => r.map(c => String(c ?? ''))))
}

export interface RosterImportReport {
  parseErrors: string[]
  totalRows: number
  students: number
  staff: number
  added: number
  changed: number
  unchanged: number
  missingFromFile: { email: string; role: string }[]
  written: boolean
}

const EMPTY_REPORT: Omit<RosterImportReport, 'parseErrors'> = {
  totalRows: 0, students: 0, staff: 0, added: 0, changed: 0, unchanged: 0, missingFromFile: [], written: false,
}

/**
 * Parses `buffer` (dispatching on `filename`'s extension), and — only if
 * every row is valid — diffs against the current naale_roster and (unless
 * dryRun) upserts. Any parse error short-circuits before touching the DB.
 */
export async function importRosterFile(
  buffer: Buffer,
  filename: string,
  db: SupabaseClient,
  opts: { dryRun: boolean }
): Promise<RosterImportReport> {
  const isXlsx = filename.toLowerCase().endsWith('.xlsx')
  const { rows, errors } = isXlsx ? parseXlsx(buffer) : parseCsv(buffer.toString('utf-8'))

  if (errors.length > 0) return { parseErrors: errors, ...EMPTY_REPORT }
  if (rows.length === 0) return { parseErrors: ['no rows found in file'], ...EMPTY_REPORT }

  const { data: existing } = await db.from('naale_roster').select('email, role')
  const existingByEmail = new Map((existing ?? []).map(r => [r.email, r.role]))
  const added = rows.filter(r => !existingByEmail.has(r.email))
  const changed = rows.filter(r => existingByEmail.has(r.email) && existingByEmail.get(r.email) !== r.role)
  const fileEmails = new Set(rows.map(r => r.email))
  const missingFromFile = (existing ?? [])
    .filter(r => !fileEmails.has(r.email))
    .map(r => ({ email: r.email, role: r.role }))

  let written = false
  if (!opts.dryRun) {
    const { error } = await db
      .from('naale_roster')
      .upsert(rows.map(({ email, role }) => ({ email, role })), { onConflict: 'email' })
    if (error) throw new Error(`upsert failed — ${error.message}`)
    written = true
  }

  return {
    parseErrors: [],
    totalRows: rows.length,
    students: rows.filter(r => r.role === 'student').length,
    staff: rows.filter(r => r.role === 'staff').length,
    added: added.length,
    changed: changed.length,
    unchanged: rows.length - added.length - changed.length,
    missingFromFile,
    written,
  }
}
