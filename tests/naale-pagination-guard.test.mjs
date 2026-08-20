// Guard test: every read of a Naale table whose row count GROWS WITH USE must
// be bounded — paginated via selectAll()/.range(), or narrowed to something
// small and fixed. PostgREST trims a response at the project's max_rows (1000
// by default) and does it silently: no error, no flag, just fewer rows.
//
// This is not hypothetical. The stats screens derived their topic list by
// reading one row per question; the MCQ bank hit exactly 1000, so the next
// import would have dropped rows — and if the dropped rows were the only ones
// for a topic, that topic would have vanished from the student's and staff's
// screens with nothing logged. See src/lib/naale/paginate.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SCAN_DIRS = [join(ROOT, 'src', 'app', 'api', 'naale'), join(ROOT, 'src', 'lib', 'naale')]

/** Tables that grow without bound as students use the app. naale_roster and
 *  naale_admins are deliberately absent: both are provisioned lists of people,
 *  capped by the size of the cohort, not by usage. */
const GROWTH_TABLES = [
  'naale_questions',
  'naale_open_questions',
  'naale_answers',
  'naale_open_answers',
  'naale_sessions',
  'naale_topic_levels',
]

/** Markers that make a read safe. `.range(` covers selectAll() too, since the
 *  call site is what passes the bounds. */
const UNIVERSAL_BOUNDS = [
  '.range(', '.limit(', '.maybeSingle()', '.single()', 'head: true',
  '.insert(', '.update(', '.upsert(', '.delete(',
]

/** Per-table filters that bound a read to a small, fixed number of rows. */
const NARROWING_BOUNDS = {
  // One session serves ~40 answers at most (30 minutes, one at a time).
  naale_answers: [".eq('session_id'"],
  naale_open_answers: [".eq('session_id'"],
  // One row per topic per student — seven topics are in scope.
  naale_topic_levels: [".eq('student_id'"],
  naale_questions: [".eq('id'", ".in('id'"],
  naale_open_questions: [".eq('id'", ".in('id'"],
  naale_sessions: [".eq('id'"],
}

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

// Comments name these tables constantly in this codebase (the paginate.ts
// docblock alone names four), so an unstripped scan would flag prose.
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

test('every growth-table read in the Naale track is bounded', () => {
  const violations = []

  for (const dir of SCAN_DIRS) {
    for (const file of sourceFiles(dir)) {
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const table of GROWTH_TABLES) {
        const needle = `.from('${table}')`
        let at = code.indexOf(needle)
        while (at !== -1) {
          // The chain runs until the next .from( or 400 chars, whichever is
          // first — so a bounded query further down can't vouch for this one.
          const rest = code.slice(at + needle.length)
          const nextFrom = rest.indexOf('.from(')
          const chain = rest.slice(0, nextFrom === -1 ? 400 : Math.min(nextFrom, 400))
          const allowed = [...UNIVERSAL_BOUNDS, ...(NARROWING_BOUNDS[table] ?? [])]
          if (!allowed.some(marker => chain.includes(marker))) {
            const line = code.slice(0, at).split('\n').length
            violations.push(`${relative(ROOT, file)}:${line} — unbounded read of ${table}`)
          }
          at = code.indexOf(needle, at + needle.length)
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Unbounded reads found. Wrap them in selectAll() from src/lib/naale/paginate.ts, ` +
    `or narrow them to a fixed number of rows:\n  ${violations.join('\n  ')}`
  )
})
