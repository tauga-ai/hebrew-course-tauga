/**
 * CLI entry point for the Naale question-bank import. The actual parsing,
 * validation, and upsert logic lives in src/lib/naale/question-import.ts,
 * shared with the /naale/admin web upload — this file only reads the
 * workbook off disk and formats the resulting report as console output.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/import-naale-questions.ts <path-to-xlsx> [--dry-run]
 */
import * as XLSX from 'xlsx'
import { createServiceClient } from '../src/lib/supabase/service'
import { runQuestionImport } from '../src/lib/naale/question-import'

async function main() {
  const xlsxPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!xlsxPath) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/import-naale-questions.ts <path-to-xlsx> [--dry-run]')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath)
  const db = createServiceClient()
  const report = await runQuestionImport(wb, db, { dryRun })

  console.log('Parsed:')
  for (const s of report.summary) {
    const byLevel = [1, 2, 3, 4, 5].map(l => `L${l}:${s.byLevel[l] ?? 0}`).join(' ')
    console.log(`  ${s.topic}: ${s.count} questions (${byLevel})`)
  }

  if (report.skippedSheets.length > 0) {
    console.log(`Skipping ${report.skippedSheets.length} sheet(s) not registered in SHEET_READERS (expected — see question-import.ts): ${report.skippedSheets.join(', ')}`)
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing written.')
  } else if (report.written) {
    console.log(`\n${report.totalRows} questions upserted into naale_questions.`)
  }

  if (report.orphans.length > 0) {
    console.log(`\n${report.orphans.length} questions in the table are NOT in this workbook (left untouched):`)
    for (const o of report.orphans.slice(0, 20)) console.log(`  - [${o.topic}] ${o.prompt.slice(0, 60)}...`)
    if (report.orphans.length > 20) console.log(`  ... and ${report.orphans.length - 20} more`)
  }

  if (report.anomalies.length > 0) {
    console.log(`\n${report.anomalies.length} anomalies found:`)
    for (const a of report.anomalies) console.log(`  - ${a}`)
    process.exitCode = 1
  } else {
    console.log('\nNo anomalies found in automated validation pass.')
  }
}

main()
