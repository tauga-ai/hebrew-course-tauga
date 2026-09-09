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
//  - The mistakes route reads correct_answer only for questions the student has
//    already answered and been shown the answer for — it is a review surface,
//    not a question-serving one, and it only returns rows where is_correct=false
//    and chosen_answer is non-null (i.e. already graded submissions).
const GRADING_ROUTES = new Set([
  'session/answer/route.ts',
  'placement/answer/route.ts',
  'my-mistakes/route.ts',
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

//  - The question-bank export route is admin-only (requireNaaleAdmin), never
//    reachable mid-session by a student, and its entire purpose is to hand a
//    content manager the full bank — including correct answers and
//    explanations — to edit and re-upload (naale-question-bank-excel-export).
//    Not a question-serving route in the sense this guard exists for.
const ADMIN_EXPORT_ROUTES = new Set([
  'admin/questions/export/route.ts',
])

//  - The staff report-page live-content route is staff-only
//    (requireNaaleStaff), never reachable mid-session by a student (it's not
//    part of the session/next question-serving flow), and its entire purpose
//    is letting staff see and fix a question's current wording — including
//    its correct answer and explanation — from a reported-question card
//    (naale-report-quick-edit). Same rationale as ADMIN_EXPORT_ROUTES, just
//    staff-gated instead of admin-gated.
const STAFF_CONTENT_ROUTES = new Set([
  'staff/questions/[id]/route.ts',
])

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
    if (GRADING_ROUTES.has(relPath) || ADMIN_EXPORT_ROUTES.has(relPath) || STAFF_CONTENT_ROUTES.has(relPath)) continue
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

// Same leak vector, second field: the per-question explanation text. Unlike
// correct_answer, there's no QA-hint use case for showing this pre-answer, so
// the question-serving routes never select or return it in any mode — no
// debugMode carve-out here, the bar is just "never referenced at all".
test('no question-serving Naale route references explanation', () => {
  const violations = []
  for (const file of findRouteFiles(NAALE_API_DIR)) {
    const relPath = relative(NAALE_API_DIR, file).replace(/\\/g, '/')
    if (GRADING_ROUTES.has(relPath) || ADMIN_EXPORT_ROUTES.has(relPath) || STAFF_CONTENT_ROUTES.has(relPath)) continue
    const content = readFileSync(file, 'utf-8')
    if (content.includes('explanation')) violations.push(relPath)
  }
  assert.deepEqual(
    violations,
    [],
    `Routes referencing explanation outside the grading routes (it must never reach the browser before submission): ${violations.join(', ')}`
  )
})
