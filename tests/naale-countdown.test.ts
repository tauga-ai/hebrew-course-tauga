import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCountdown } from '../src/lib/naale/use-countdown'

test('formatCountdown: pads seconds to two digits', () => {
  assert.equal(formatCountdown(1800), '30:00')
  assert.equal(formatCountdown(125), '2:05')
  assert.equal(formatCountdown(59), '0:59')
  assert.equal(formatCountdown(0), '0:00')
})
