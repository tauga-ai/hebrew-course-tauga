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

test('every service-role API route derives identity from an auth helper', () => {
  const violations = []

  for (const file of findRouteFiles(API_DIR)) {
    const relPath = relative(API_DIR, file).replace(/\\/g, '/')
    const content = readFileSync(file, 'utf-8')

    const usesServiceClient = content.includes('createServiceClient')
    if (!usesServiceClient) continue

    const hasAuthHelper =
      content.includes('getStudentFromSession') ||
      content.includes('requireTeacher') ||
      // Naale-track routes authenticate via getNaaleSession(), which wraps the
      // same Supabase-user lookup and additionally checks the caller's roster
      // role and that their class is on the 'naale' track (see
      // src/lib/naale/auth.ts). A real auth helper, not an exemption.
      content.includes('getNaaleSession')

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
