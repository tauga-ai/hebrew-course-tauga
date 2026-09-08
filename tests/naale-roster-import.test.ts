import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateRows } from '../src/lib/naale/roster-import'

test('validateRows: legacy 2-column shape still works', () => {
  const { rows, errors } = validateRows([['email', 'role'], ['a@b.com', 'student']])
  assert.equal(errors.length, 0)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].email, 'a@b.com')
  assert.equal(rows[0].role, 'student')
  assert.equal(rows[0].firstName, undefined)
  assert.equal(rows[0].phone, undefined)
})

test('validateRows: 5-column shape captures name/phone', () => {
  const { rows, errors } = validateRows([
    ['שם', 'שם משפחה', 'כתובת מייל', 'מספר טלפון', 'role'],
    ['אווה', 'דזוגייב', 'evadzugaeva1@gmail.com', '509110614', 'student'],
  ])
  assert.equal(errors.length, 0)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].email, 'evadzugaeva1@gmail.com')
  assert.equal(rows[0].firstName, 'אווה')
  assert.equal(rows[0].lastName, 'דזוגייב')
  assert.equal(rows[0].phone, '509110614')
})

test('validateRows: wrong field count still errors', () => {
  const { errors } = validateRows([['a@b.com', 'student', 'extra']])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /expected 2 fields.*or 5 fields/)
})

test('validateRows: 5-column row with blank name/phone is allowed', () => {
  const { rows, errors } = validateRows([['', '', 'a@b.com', '', 'student']])
  assert.equal(errors.length, 0)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].firstName, undefined)
  assert.equal(rows[0].phone, undefined)
})

test('validateRows: 5-column row with invalid email still errors', () => {
  const { errors } = validateRows([['ארז', 'חאמד', '', '549581733', 'student']])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /not a valid email/)
})

test('validateRows: duplicate email across mixed shapes still errors', () => {
  const { errors } = validateRows([
    ['a@b.com', 'student'],
    ['שם', 'שם', 'a@b.com', '123', 'staff'],
  ])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /duplicate email/)
})
