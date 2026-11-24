import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isNaaleRosterStudent } from '../src/lib/naale/roster-guard'

// Minimal stand-in for db.from(...).select(...).ilike(...).maybeSingle()
function fakeDb(row: { role: string } | null, seen?: { email?: string }) {
  return {
    from: () => ({
      select: () => ({
        ilike: (_col: string, email: string) => {
          if (seen) seen.email = email
          return { maybeSingle: async () => ({ data: row }) }
        },
      }),
    }),
  } as unknown as SupabaseClient
}

test('roster student -> true', async () => {
  assert.equal(await isNaaleRosterStudent(fakeDb({ role: 'student' }), 'a@b.co'), true)
})

test('roster staff -> false (staff may use the other course)', async () => {
  assert.equal(await isNaaleRosterStudent(fakeDb({ role: 'staff' }), 'a@b.co'), false)
})

test('not on roster -> false', async () => {
  assert.equal(await isNaaleRosterStudent(fakeDb(null), 'a@b.co'), false)
})

test('no email -> false, and the db is never queried', async () => {
  const seen: { email?: string } = {}
  assert.equal(await isNaaleRosterStudent(fakeDb({ role: 'student' }, seen), null), false)
  assert.equal(seen.email, undefined)
})

test('email is passed through as given (case handled by ilike)', async () => {
  const seen: { email?: string } = {}
  await isNaaleRosterStudent(fakeDb({ role: 'student' }, seen), 'Dana@School.org')
  assert.equal(seen.email, 'Dana@School.org')
})

// Where a Google sign-in lands. Only the default Hebrew-course target is ever rewritten.
import { postGoogleSignInTarget } from '../src/lib/naale/roster-guard'

test('roster student with no Hebrew-course profile -> /naale', () => {
  assert.equal(postGoogleSignInTarget('/student/complete-profile', false, true), '/naale')
})

test('roster student who already has a Hebrew-course profile is left alone', () => {
  assert.equal(postGoogleSignInTarget('/student/complete-profile', true, true), '/student/complete-profile')
})

test('non-roster student is left alone', () => {
  assert.equal(postGoogleSignInTarget('/student/complete-profile', false, false), '/student/complete-profile')
})

test('an explicit target (e.g. /naale from the Naale login) is never rewritten', () => {
  assert.equal(postGoogleSignInTarget('/naale', false, true), '/naale')
  assert.equal(postGoogleSignInTarget('/menu', false, true), '/menu')
})
