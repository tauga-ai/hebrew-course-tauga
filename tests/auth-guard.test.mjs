// Guard test: every API route that reads/writes via createServiceClient
// (service-role, bypasses RLS) must derive identity from an auth helper
// (getStudentFromSession/requireTeacher) rather than trusting a client-
// supplied id — that IDOR class of bug is exactly what this project's
// auth overhaul fixed. Routes with no personal data (public content) are
// explicitly allowlisted below.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const API_DIR = join(import.meta.dirname, '..', 'src', 'app', 'api')

const PUBLIC_ROUTES = new Set([
  'practice-sets/route.ts',
  'practice-sets/[setId]/route.ts',
])

function findRouteFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      results.push(full)
    }
  }
  return results
}

// Strips comments before matching — otherwise a route whose real auth-helper
// call is removed but whose explanatory comment still names the helper (a
// documentation style this codebase encourages, see src/lib/naale/auth.ts's
// own docblocks) would silently keep passing. Found by deliberately removing
// a real call and watching this test NOT go red, per this ticket's own
// "a guard test nobody has seen fail is not known to work" standard.
// Simple regex strip, not a real parser — good enough for this purpose;
// doesn't need to handle a helper name appearing inside a string literal.
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

test('every service-role API route derives identity from an auth helper', () => {
  const violations = []

  for (const file of findRouteFiles(API_DIR)) {
    const relPath = relative(API_DIR, file).replace(/\\/g, '/')
    const content = stripComments(readFileSync(file, 'utf-8'))

    const usesServiceClient = content.includes('createServiceClient')
    if (!usesServiceClient) continue

    const hasAuthHelper =
      content.includes('getStudentFromSession') ||
      content.includes('requireTeacher') ||
      // Naale-track routes authenticate via getNaaleSession(), which wraps the
      // same Supabase-user lookup and additionally checks the caller's roster
      // role and that their class is on the 'naale' track (see
      // src/lib/naale/auth.ts). A real auth helper, not an exemption.
      content.includes('getNaaleSession') ||
      // requireNaaleStaff() wraps getNaaleSession() with an additional
      // role === 'staff' check, for the handful of routes only staff may
      // call (e.g. reading every student's stats) — same relationship as
      // requireTeacher() to the main app's auth.
      content.includes('requireNaaleStaff') ||
      // requireNaaleAdmin() checks naale_admins directly — a real identity
      // check, not an exemption, same relationship as requireNaaleStaff().
      content.includes('requireNaaleAdmin')

    if (!hasAuthHelper && !PUBLIC_ROUTES.has(relPath)) {
      violations.push(relPath)
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Routes using createServiceClient with no auth helper (add getStudentFromSession()/requireTeacher(), or allowlist in PUBLIC_ROUTES if genuinely public): ${violations.join(', ')}`
  )
})
