/**
 * CLI entry point for the Naale roster import. Parsing/validation/upsert
 * logic lives in src/lib/naale/roster-import.ts, shared with the
 * /naale/admin web upload.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/import-naale-roster.ts <path-to-file> [--dry-run]
 *
 * Accepts a .csv or .xlsx file, two columns: email, role (student|staff).
 */
import { readFileSync } from 'fs'
import { createServiceClient } from '../src/lib/supabase/service'
import { importRosterFile } from '../src/lib/naale/roster-import'

async function main() {
  const filePath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!filePath) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/import-naale-roster.ts <path-to-file> [--dry-run]')
    process.exit(1)
  }

  const buffer = readFileSync(filePath)
  const db = createServiceClient()
  const report = await importRosterFile(buffer, filePath, db, { dryRun })

  if (report.parseErrors.length > 0) {
    console.error(`${report.parseErrors.length} problems found, nothing was written:`)
    for (const e of report.parseErrors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`Parsed ${report.totalRows} rows: ${report.students} student, ${report.staff} staff.`)
  console.log(`  ${report.added} new, ${report.changed} role changes, ${report.unchanged} unchanged.`)
  console.log(dryRun ? '\n--dry-run: nothing written.' : '\nRoster updated.')

  if (report.missingFromFile.length > 0) {
    console.log(`\n${report.missingFromFile.length} roster entries are NOT in this file (left untouched):`)
    for (const r of report.missingFromFile) console.log(`  - ${r.email} (${r.role})`)
  }
}

main()
