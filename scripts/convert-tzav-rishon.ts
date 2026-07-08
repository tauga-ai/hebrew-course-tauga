/**
 * One-time conversion: the "300 שאלות דפר מתורגמות לערבית.xlsx" source workbook
 * into per-topic JSON data files under src/data/tzav-rishon/<topic>/data.json.
 *
 * Run with: npx tsx scripts/convert-tzav-rishon.ts <path-to-xlsx>
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
  question: { he: Segment[]; ar: Segment[] }
  options: { he: Segment[]; ar: Segment[] }[]
  correctOption: number
  explanation: { he: Segment[]; ar: Segment[] }
}

const SHEET_TO_TOPIC: Record<string, string> = {
  'אחוזים': 'percentages',
  'ממוצעים': 'averages',
  'תנועה': 'motion',
  'הסתברות': 'probability',
}

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

function readSheet(wb: XLSX.WorkBook, sheetName: string): QuestionOut[] {
  const ws = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const dataRows = rows.slice(1) // row 0 is the header

  return dataRows.map((row, idx) => {
    const [
      , // Content Name he — not used, id is derived from position instead
      , // Content Name ar
      qHe, qAr,
      optHe, optAr,
      caHe, caAr,
      expHe, expAr,
    ] = row.map(c => String(c ?? ''))

    const optionsHe = parseOptions(optHe)
    const optionsAr = parseOptions(optAr)
    if (optionsHe.length !== 4 || optionsAr.length !== 4) {
      throw new Error(`${sheetName} row ${idx + 2}: expected 4 options, got he=${optionsHe.length} ar=${optionsAr.length}`)
    }

    // Trust Arabic as the source of truth for the correct answer (per
    // decision — the Hebrew ✓ marker is missing on one real row).
    void caHe
    const correctOption = parseCorrectIndex(caAr)

    return {
      id: idx + 1,
      question: { he: splitSegments(qHe), ar: splitSegments(qAr) },
      options: optionsHe.map((o, i) => ({
        he: splitSegments(o.text),
        ar: splitSegments(optionsAr[i].text),
      })),
      correctOption,
      explanation: { he: splitSegments(expHe), ar: splitSegments(expAr) },
    }
  })
}

function validate(topic: string, questions: QuestionOut[], anomalies: string[]) {
  if (questions.length !== 75) {
    anomalies.push(`${topic}: expected 75 questions, got ${questions.length}`)
  }
  for (const q of questions) {
    if (q.options.length !== 4) anomalies.push(`${topic} q${q.id}: ${q.options.length} options, expected 4`)
    if (q.correctOption < 1 || q.correctOption > 4) {
      anomalies.push(`${topic} q${q.id}: correctOption=${q.correctOption} out of range`)
    }
    const allSegmentArrays: [string, Segment[]][] = [
      ['question.he', q.question.he], ['question.ar', q.question.ar],
      ['explanation.he', q.explanation.he], ['explanation.ar', q.explanation.ar],
      ...q.options.flatMap((o, i): [string, Segment[]][] => [
        [`option[${i}].he`, o.he], [`option[${i}].ar`, o.ar],
      ]),
    ]
    for (const [label, segs] of allSegmentArrays) {
      const lastSeg = segs[segs.length - 1]
      if (lastSeg && /[…]|\.\.\.\s*$/.test(lastSeg.content)) {
        anomalies.push(`${topic} q${q.id} ${label}: ends with an ellipsis — likely truncated content in the source spreadsheet, not a parsing issue`)
      }
      for (const seg of segs) {
        if (seg.type === 'text' && seg.content.includes('\\')) {
          anomalies.push(`${topic} q${q.id} ${label}: stray backslash left in text segment: ${JSON.stringify(seg.content)}`)
        }
        if (seg.type === 'math') {
          const opens = (seg.content.match(/\{/g) || []).length
          const closes = (seg.content.match(/\}/g) || []).length
          if (opens !== closes) {
            anomalies.push(`${topic} q${q.id} ${label}: unbalanced braces in math segment: ${JSON.stringify(seg.content)}`)
          }
          if (seg.content.length > 150) {
            anomalies.push(`${topic} q${q.id} ${label}: suspiciously long math segment (${seg.content.length} chars): ${JSON.stringify(seg.content.slice(0, 80))}...`)
          }
          if (/[٠-٩]/.test(seg.content)) {
            anomalies.push(`${topic} q${q.id} ${label}: Eastern Arabic-Indic digit found in math segment: ${JSON.stringify(seg.content)}`)
          }
        }
      }
    }
    const explanationWordCount = q.explanation.he
      .map(s => s.content)
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length
    if (explanationWordCount > 100) {
      anomalies.push(`${topic} q${q.id}: explanation is ${explanationWordCount} words (header says "≤100 words")`)
    }
  }
}

function main() {
  const xlsxPath = process.argv[2]
  if (!xlsxPath) {
    console.error('Usage: npx tsx scripts/convert-tzav-rishon.ts <path-to-xlsx>')
    process.exit(1)
  }

  const wb = XLSX.readFile(xlsxPath)
  const outRoot = join(__dirname, '..', 'src', 'data', 'tzav-rishon')
  const anomalies: string[] = []
  const summary: { topic: string; count: number }[] = []

  for (const [sheetName, topicKey] of Object.entries(SHEET_TO_TOPIC)) {
    if (!wb.Sheets[sheetName]) {
      anomalies.push(`Sheet not found in workbook: ${sheetName}`)
      continue
    }
    const questions = readSheet(wb, sheetName)
    validate(topicKey, questions, anomalies)

    const topicDir = join(outRoot, topicKey)
    if (!existsSync(topicDir)) mkdirSync(topicDir, { recursive: true })
    writeFileSync(join(topicDir, 'data.json'), JSON.stringify(questions, null, 2) + '\n', 'utf-8')
    summary.push({ topic: topicKey, count: questions.length })
  }

  console.log('Conversion complete:')
  for (const s of summary) console.log(`  ${s.topic}: ${s.count} questions -> src/data/tzav-rishon/${s.topic}/data.json`)

  if (anomalies.length > 0) {
    console.log(`\n${anomalies.length} anomalies found:`)
    for (const a of anomalies) console.log(`  - ${a}`)
    process.exitCode = 1
  } else {
    console.log('\nNo anomalies found in automated validation pass.')
  }
}

main()
