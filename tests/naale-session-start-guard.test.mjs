// Guard test: every client-side caller of /api/naale/session/start must go
// through the pre-session sheet.
//
// That route CREATES the naale_sessions row and stamps deadline_at, so the
// timer begins the moment it is called. The 30-minute length, the fact that
// leaving early means the session does not count however much was answered
// (isSessionCompleted requires the timer to elapse), and the 50 XP for
// completing are all facts a student can only learn from StartSessionSheet.
// A new screen that POSTs straight to the route commits someone to half an
// hour from a button that never said so — and does it silently, since nothing
// about that fails a build.
//
// Mirrors tests/auth-guard.test.mjs: a static scan over source, with an
// explicit allowlist so a deliberate exception has to be written down.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const APP = join(ROOT, 'src', 'app')

/** The route being guarded, as it appears in a client fetch. */
const START_ROUTE = "'/api/naale/session/start'"

/** The component that states the terms before the clock starts. */
const SHEET = 'StartSessionSheet'

/** The one caller that is exempt, and the file the exemption is scoped to. */
const RESUME_ONLY_FILE = join('src', 'app', 'naale', 'session', 'page.tsx')

/**
 * Files allowed to call the route without the sheet, each with a reason.
 * Add an entry only with a real justification, not to make this test pass.
 */
const ALLOWLIST = new Map([
  [
    RESUME_ONLY_FILE,
    // Resumes, never creates. Returning to a backgrounded tab restarts the
    // server clock on a session the student is already inside — they accepted
    // the terms at the sheet before it began, and no new deadline_at is
    // stamped (naale-topic-session-resume). Showing the sheet again here would
    // ask someone mid-practice to agree to start the thing they are already
    // doing. Kept narrow by the companion test below: every call in this file
    // must carry action:'resume', so a future call that genuinely starts a
    // session still fails.
    'resume-on-return only; see naale-topic-session-resume',
  ],
])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

test('every client caller of session/start shows the pre-session sheet first', () => {
  const offenders = []

  for (const file of walk(APP)) {
    const src = readFileSync(file, 'utf8')
    if (!src.includes(START_ROUTE)) continue

    const rel = relative(ROOT, file)
    if (ALLOWLIST.has(rel)) continue
    if (!src.includes(SHEET)) offenders.push(rel)
  }

  assert.deepEqual(
    offenders,
    [],
    `These files POST to /api/naale/session/start without rendering ${SHEET}, so they start a ` +
      `30-minute timed session from a control that never states the terms. Render the sheet and ` +
      `call the route from its onStart, or add the file to ALLOWLIST with a reason.`
  )
})

test('the sheet itself never calls the route it guards', () => {
  // The sheet decides WHETHER to start; the page it is rendered from decides
  // HOW. If the sheet ever fetched the route itself, the guard above would
  // pass for any page that merely imported it.
  const sheet = readFileSync(join(ROOT, 'src', 'components', 'naale', 'StartSessionSheet.tsx'), 'utf8')
  assert.ok(
    !sheet.includes(`fetch(${START_ROUTE}`),
    'StartSessionSheet must not call session/start itself — it takes an onStart callback'
  )
})

test('the allowlisted session page resumes and never starts', () => {
  // The allowlist above is per-FILE, which would otherwise let a later call in
  // the same file start a fresh timed session with no sheet — exactly what the
  // guard exists to prevent. This narrows the exemption to the operation that
  // earned it.
  const src = readFileSync(join(ROOT, RESUME_ONLY_FILE), 'utf8')
  const calls = src.split(`fetch(${START_ROUTE}`).slice(1)

  assert.ok(
    calls.length > 0,
    `${RESUME_ONLY_FILE} no longer calls session/start — drop its ALLOWLIST entry rather than ` +
      `leaving a stale exemption behind.`
  )

  for (const call of calls) {
    assert.ok(
      call.slice(0, 400).includes("action: 'resume'"),
      `A call to session/start in ${RESUME_ONLY_FILE} does not pass action:'resume'. That file is ` +
        `allowlisted from the pre-session sheet ONLY because it resumes an in-progress session. A ` +
        `call that creates one must render ${SHEET} instead.`
    )
  }
})
