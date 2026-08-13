// Guard test: no Naale route that serves a question to the browser may leak
// correct_answer. A leak here doesn't break anything visibly — the UI works, the
// scores are just meaningless, and it would silently affect every stored result.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const NAALE_API_DIR = join(import.meta.dirname, '..', 'src', 'app', 'api', 'naale')

// Routes that legitimately reference correct_answer, and why:
//  - The two answer routes GRADE, and only return it after the student has
//    already submitted.
const GRADING_ROUTES = new Set([
  'session/answer/route.ts',
  'placement/answer/route.ts',
])
//  - The three question-serving routes gate it behind `debugMode` (a
//    process.env.NEXT_PUBLIC_DEBUG_MODE check, baked in at build time, never
//    client-controlled) purely for the QA hint toggle (DevPanel), and
//    explicitly strip it on every other path. Allowlisted here ONLY because
//    each is separately verified below to still contain that exact strip —
//    a route added to this set without the strip still fails.
const DEV_HINT_ROUTES = new Set([
  'session/next/route.ts',
  'session/review-next/route.ts',
  'placement/next/route.ts',
])
const STRIP_PATTERN = 'correct_answer: undefined'

function findRouteFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) results.push(...findRouteFiles(full))
    else if (entry === 'route.ts') results.push(full)
  }
  return results
}

test('no question-serving Naale route selects correct_answer', () => {
  const violations = []
  for (const file of findRouteFiles(NAALE_API_DIR)) {
    const relPath = relative(NAALE_API_DIR, file).replace(/\\/g, '/')
    if (GRADING_ROUTES.has(relPath)) continue
    const content = readFileSync(file, 'utf-8')
    if (!content.includes('correct_answer')) continue
    if (DEV_HINT_ROUTES.has(relPath) && content.includes(STRIP_PATTERN)) continue
    violations.push(relPath)
  }
  assert.deepEqual(
    violations,
    [],
    `Routes referencing correct_answer outside the allowed routes, or missing the debugMode strip (the answer must never reach the browser before submission, except behind a server-only debugMode check that explicitly strips it elsewhere): ${violations.join(', ')}`
  )
})
