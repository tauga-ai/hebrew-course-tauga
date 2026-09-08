/**
 * Parsing and upsert logic for the Naale roster (email + role, optionally
 * name + phone — naale-roster-name-phone), shared by
 * scripts/import-naale-roster.ts (CLI) and /api/naale/admin/roster/import
 * (web upload). Accepts a CSV or an Excel file, in either the legacy
 * 2-column (email, role) shape or the real school-provided 5-column shape
 * (first_name, last_name, email, phone, role) — both are supported so an
 * older minimal file still imports unchanged.
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
  firstName?: string
  lastName?: string
  phone?: string
  line: number
}

interface ParseResult {
  rows: ParsedRow[]
  errors: string[]
}

/** Shared row-level validation, regardless of source format — a valid row is
 *  either [email, role] (legacy) or [first_name, last_name, email, phone,
 *  role] (the real school-provided shape, naale-roster-name-phone), nothing
 *  else. */
export function validateRows(rawRows: string[][]): ParseResult {
  const rows: ParsedRow[] = []
  const errors: string[] = []
  const seen = new Map<string, number>()

  rawRows.forEach((fields, idx) => {
    const line = idx + 1
    const trimmed = fields.map(f => String(f ?? '').trim())
    if (trimmed.every(f => f === '')) return // blank row, skip silently

    // Header tolerance for both shapes — only at row 1, only an exact match
    // on the column that would be "email" in each shape.
    if (idx === 0 && (trimmed[0]?.toLowerCase() === 'email' || trimmed[2] === 'כתובת מייל')) return

    let email: string, role: string
    let firstName: string | undefined, lastName: string | undefined, phone: string | undefined

    if (trimmed.length === 2) {
      ;[email, role] = trimmed
    } else if (trimmed.length === 5) {
      ;[firstName, lastName, email, phone, role] = trimmed
    } else {
      errors.push(`line ${line}: expected 2 fields (email,role) or 5 fields (first_name,last_name,email,phone,role), got ${trimmed.length}: ${JSON.stringify(trimmed)}`)
      return
    }

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
    rows.push({
      email: normalizedEmail,
      role: role as NaaleRosterRole,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone: phone || undefined,
      line,
    })
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
    // Explicit `?? null` rather than omitting the key: re-importing a row
    // whose name/phone was removed from the source file should clear it,
    // not leave a stale value from a previous import.
    const { error } = await db
      .from('naale_roster')
      .upsert(
        rows.map(({ email, role, firstName, lastName, phone }) => ({
          email,
          role,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          phone: phone ?? null,
        })),
        { onConflict: 'email' }
      )
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
