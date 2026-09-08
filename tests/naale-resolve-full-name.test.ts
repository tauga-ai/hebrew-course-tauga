import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveFullName } from '../src/lib/naale/auth'
import type { User } from '@supabase/supabase-js'

function userWith(fullName: string | undefined): User {
  return { user_metadata: { full_name: fullName } } as unknown as User
}

test('resolveFullName: Google name wins even when the roster also has a name', () => {
  const name = resolveFullName(userWith('דנה כהן'), 'דנה', 'כהן-אחר')
  assert.equal(name, 'דנה כהן')
})

test('resolveFullName: falls back to roster first+last name with no Google identity', () => {
  const name = resolveFullName(userWith(undefined), 'אווה', 'דזוגייב')
  assert.equal(name, 'אווה דזוגייב')
})

test('resolveFullName: roster first name only (no last name) still resolves', () => {
  const name = resolveFullName(userWith(undefined), 'אווה', null)
  assert.equal(name, 'אווה')
})

test('resolveFullName: nothing on either side returns null, not a fallback string', () => {
  const name = resolveFullName(userWith(undefined), null, null)
  assert.equal(name, null)
})

test('resolveFullName: blank Google name is treated as absent', () => {
  const name = resolveFullName(userWith('   '), 'אווה', 'דזוגייב')
  assert.equal(name, 'אווה דזוגייב')
})
