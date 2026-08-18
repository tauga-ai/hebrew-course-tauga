/**
 * CLI entry point for the Naale question-bank import. The actual parsing,
 * validation, and upsert logic lives in src/lib/naale/question-import.ts
 * (multiple-choice sheets) and src/lib/naale/open-question-import.ts
 * (free-text, AI-graded sheets) — both shared with the /naale/admin web
 * upload, which runs the same two importers against the same file, so the
 * CLI and web path can never silently diverge. This file only reads the
 * workbook off disk and formats both reports as console output.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/import-naale-questions.ts <path-to-xlsx> [--dry-run]
 */
import * as XLSX from 'xlsx'
import { createServiceClient } from '../src/lib/supabase/service'
import { runQuestionImport, type QuestionImportReport } from '../src/lib/naale/question-import'
import { runOpenQuestionImport, type OpenQuestionImportReport } from '../src/lib/naale/open-question-import'

function printReport(label: string, tableName: string, report: QuestionImportReport | OpenQuestionImportReport, dryRun: boolean) {
  console.log(`\n=== ${label} ===`)
  console.log('Parsed:')
  for (const s of report.summary) {
    const byLevel = [1, 2, 3, 4, 5].map(l => `L${l}:${s.byLevel[l] ?? 0}`).join(' ')
    console.log(`  ${s.topic}: ${s.count} questions (${byLevel})`)
  }

  if (report.skippedSheets.length > 0) {
    console.log(`Skipping ${report.skippedSheets.length} sheet(s) not registered for this importer (expected — belongs to the other content kind or has no reader yet): ${report.skippedSheets.join(', ')}`)
  }

  if (dryRun) {
    console.log('--dry-run: nothing written.')
  } else if (report.written) {
    console.log(`${report.totalRows} questions upserted into ${tableName}.`)
  }

  if (report.orphans.length > 0) {
    console.log(`${report.orphans.length} questions in the table are NOT in this workbook (left untouched):`)
    for (const o of report.orphans.slice(0, 20)) console.log(`  - [${o.topic}] ${o.prompt.slice(0, 60)}...`)
    if (report.orphans.length > 20) console.log(`  ... and ${report.orphans.length - 20} more`)
  }

  if (report.anomalies.length > 0) {
    console.log(`${report.anomalies.length} anomalies found:`)
    for (const a of report.anomalies) console.log(`  - ${a}`)
    return false
  }
  console.log('No anomalies found in automated validation pass.')
  return true
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

  const [mcqReport, openReport] = await Promise.all([
    runQuestionImport(wb, db, { dryRun }),
    runOpenQuestionImport(wb, db, { dryRun }),
  ])

  const mcqClean = printReport('Multiple-choice sheets', 'naale_questions', mcqReport, dryRun)
  const openClean = printReport('Free-text (AI-graded) sheets', 'naale_open_questions', openReport, dryRun)

  if (!mcqClean || !openClean) process.exitCode = 1
}

main()
