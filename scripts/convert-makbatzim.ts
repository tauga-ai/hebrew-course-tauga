/**
 * One-time conversion: the "קובץ CSV מקבצי כמותי.xlsx" source workbook into
 * per-set JSON data files under src/data/makbatzim/<set>/data.json.
 *
 * Run with: npx tsx scripts/convert-makbatzim.ts <path-to-xlsx>
 *
 * Unlike scripts/convert-tzav-rishon.ts, this source's sheets do NOT share a
 * fixed column layout (8 columns on the four "מקבץ N" sheets, 7 on the
 * "צורני" sheet with no Sub-Subject column, 9 on the simulation sheet with a
 * leading מקבץ column) — so this script looks up columns by header name
 * per-sheet instead of destructuring by fixed position. `Sub-Subject`,
 * `Content Name`, `Content Type` and the simulation sheet's `מקבץ` column are
 * read but deliberately dropped from the output: nothing in the app needs
 * them today (Content Type in particular is not a reliable rendering
 * signal — see below), and they're cheap to bring back later by re-running
 * this script against the same source file.
 *
 * Re-run this whenever the source Excel is corrected — it fully regenerates
 * the output files and re-runs the validation pass below.
 */
import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { splitSegments, type Segment } from '../src/lib/tzav-rishon-segments'

interface QuestionOut {
  id: number
  question: Segment[]
  imageUrl?: string
  options: Segment[][]
  correctOption: number
  explanation: Segment[]
}

const SHEET_TO_SET: Record<string, string> = {
  'מקבץ 1': 'set-1',
  'מקבץ 2': 'set-2',
  'מקבץ 3': 'set-3',
  'מקבץ 4': 'set-4',
  'מקבץ 1- צורני': 'set-1-tzurani',
  'מקבץ 1- אנלוגיות מילוליות': 'set-1-analogies',
  'מקבץ 1- הוראות': 'set-1-instructions',
  // Renamed from 'סימולציה דפר' in the source workbook once the sheet was
  // refreshed with 40 updated questions — the old key is gone, not kept
  // alongside, so a stale/mismatched source file surfaces as a clear
  // "Sheet not found" anomaly instead of silently mapping the wrong sheet.
  'סימולציה דפר- מעודכן': 'dapar-simulation',
}

// Real, confirmed row counts per sheet in the source workbook — used by the
// validation pass below, not to constrain parsing itself.
const EXPECTED_COUNT: Record<string, number> = {
  'set-1': 9,
  'set-2': 10,
  'set-3': 10,
  'set-4': 10,
  'set-1-tzurani': 9,
  'set-1-analogies': 9,
  'set-1-instructions': 10,
  'dapar-simulation': 40,
}

const REQUIRED_COLUMNS = ['Question', 'Options', 'Correct Answer', 'Explanation', 'Image URL'] as const

function parseOptions(cell: string): { num: number; text: string }[] {
  return cell
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(\d+)\)\s*(.*)$/)
      if (!m) throw new Error(`Unparseable option line: ${JSON.stringify(line)}`)
      const text = m[2].replace(/\s*✓\s*$/, '').trim()
      return { num: parseInt(m[1], 10), text }
    })
}

function parseCorrectIndex(cell: string): number {
  const m = cell.trim().match(/^(\d+)\)/)
  if (!m) throw new Error(`Unparseable correct-answer cell: ${JSON.stringify(cell)}`)
  return parseInt(m[1], 10)
}

/** Maps each required column name to its index in this sheet's own header row — sheets don't share a fixed layout. */
function buildColumnMap(headerRow: string[], sheetName: string): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((name, i) => { map[name.trim()] = i })
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in map)) throw new Error(`${sheetName}: missing expected column "${col}" in header row`)
  }
  return map
}

function readSheet(wb: XLSX.WorkBook, sheetName: string): QuestionOut[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const [headerRow, ...dataRows] = rows
  const col = buildColumnMap(headerRow.map(c => String(c ?? '')), sheetName)

  return dataRows.map((row, idx) => {
    const cell = (name: string) => String(row[col[name]] ?? '')

    const options = parseOptions(cell('Options'))
    if (options.length !== 4) {
      throw new Error(`${sheetName} row ${idx + 2}: expected 4 options, got ${options.length}`)
    }
    const correctOption = parseCorrectIndex(cell('Correct Answer'))
    const imageUrl = cell('Image URL').trim() || undefined

    return {
      id: idx + 1,
      question: splitSegments(cell('Question')),
      ...(imageUrl ? { imageUrl } : {}),
      options: options.map(o => splitSegments(o.text)),
      correctOption,
      explanation: splitSegments(cell('Explanation')),
    }
  })
}

function validate(setKey: string, questions: QuestionOut[], anomalies: string[]) {
  const expected = EXPECTED_COUNT[setKey]
  if (questions.length !== expected) {
    anomalies.push(`${setKey}: expected ${expected} questions, got ${questions.length}`)
  }
  for (const q of questions) {
    if (q.options.length !== 4) anomalies.push(`${setKey} q${q.id}: ${q.options.length} options, expected 4`)
    if (q.correctOption < 1 || q.correctOption > 4) {
      anomalies.push(`${setKey} q${q.id}: correctOption=${q.correctOption} out of range`)
    }
    const allSegmentArrays: [string, Segment[]][] = [
      ['question', q.question],
      ['explanation', q.explanation],
      ...q.options.map((o, i): [string, Segment[]] => [`option[${i}]`, o]),
    ]
    for (const [label, segs] of allSegmentArrays) {
      const lastSeg = segs[segs.length - 1]
      if (lastSeg && /[…]|\.\.\.\s*$/.test(lastSeg.content)) {
        anomalies.push(`${setKey} q${q.id} ${label}: ends with an ellipsis — likely truncated content in the source spreadsheet, not a parsing issue`)
      }
      for (const seg of segs) {
        if (seg.type === 'text' && seg.content.includes('\\')) {
          anomalies.push(`${setKey} q${q.id} ${label}: stray backslash left in text segment: ${JSON.stringify(seg.content)}`)
        }
        if (seg.type === 'math') {
          const opens = (seg.content.match(/\{/g) || []).length
          const closes = (seg.content.match(/\}/g) || []).length
          if (opens !== closes) {
            anomalies.push(`${setKey} q${q.id} ${label}: unbalanced braces in math segment: ${JSON.stringify(seg.content)}`)
          }
          if (seg.content.length > 150) {
            anomalies.push(`${setKey} q${q.id} ${label}: suspiciously long math segment (${seg.content.length} chars): ${JSON.stringify(seg.content.slice(0, 80))}...`)
          }
        }
      }
    }
  }
}

function main() {
  const xlsxPath = process.argv[2]
  if (!xlsxPath) {
    console.error('Usage: npx tsx scripts/convert-makbatzim.ts <path-to-xlsx>')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath)
  const outRoot = join(__dirname, '..', 'src', 'data', 'makbatzim')
  const anomalies: string[] = []
  const summary: { set: string; count: number; images: number }[] = []

  for (const [sheetName, setKey] of Object.entries(SHEET_TO_SET)) {
    if (!wb.Sheets[sheetName]) {
      anomalies.push(`Sheet not found in workbook: ${sheetName}`)
      continue
    }
    const questions = readSheet(wb, sheetName)
    validate(setKey, questions, anomalies)

    const setDir = join(outRoot, setKey)
    if (!existsSync(setDir)) mkdirSync(setDir, { recursive: true })
    writeFileSync(join(setDir, 'data.json'), JSON.stringify(questions, null, 2) + '\n', 'utf-8')
    summary.push({ set: setKey, count: questions.length, images: questions.filter(q => q.imageUrl).length })
  }

  console.log('Conversion complete:')
  for (const s of summary) console.log(`  ${s.set}: ${s.count} questions (${s.images} with images) -> src/data/makbatzim/${s.set}/data.json`)

  if (anomalies.length > 0) {
    console.log(`\n${anomalies.length} anomalies found:`)
    for (const a of anomalies) console.log(`  - ${a}`)
    process.exitCode = 1
  } else {
    console.log('\nNo anomalies found in automated validation pass.')
  }
}

main()
