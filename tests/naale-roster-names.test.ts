import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownNameIfDifferent, staffDisplayName } from '../src/lib/naale/roster-names'

const roster = new Map([['dana@school.org', 'דנה כהן']])

test('staffDisplayName: roster name wins over the student\'s own name', () => {
  assert.equal(staffDisplayName(roster, 'dana@school.org', 'Dana the Great'), 'דנה כהן')
})

test('staffDisplayName: email case does not matter', () => {
  assert.equal(staffDisplayName(roster, 'Dana@School.org', 'Dana the Great'), 'דנה כהן')
})

test('staffDisplayName: no roster name falls back to full_name', () => {
  assert.equal(staffDisplayName(roster, 'other@school.org', 'Виктория'), 'Виктория')
  assert.equal(staffDisplayName(roster, undefined, 'Виктория'), 'Виктория')
})

test('ownNameIfDifferent: only returns the student\'s own name when it differs', () => {
  assert.equal(ownNameIfDifferent('דנה כהן', 'Dana the Great'), 'Dana the Great')
  assert.equal(ownNameIfDifferent('דנה כהן', 'דנה כהן'), null)
})
