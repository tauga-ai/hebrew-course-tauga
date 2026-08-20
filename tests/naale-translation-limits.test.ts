/**
 * The per-session translation cap is deliberately not a literal at the call
 * site: Noam raised it from 30 to 150 when the trigger became hover, and has
 * floated making it adaptive to the student's level later. These tests pin the
 * two properties that matter — the number is overridable without a code
 * change, and a bad override can never take the translate route down.
 */
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SESSION_TRANSLATION_CAP,
  TRANSLATION_CAP_ENV,
  sessionTranslationCap,
} from '@/lib/naale/translation-limits'

afterEach(() => { delete process.env[TRANSLATION_CAP_ENV] })

test('defaults to the documented cap when unset', () => {
  delete process.env[TRANSLATION_CAP_ENV]
  assert.equal(sessionTranslationCap(), DEFAULT_SESSION_TRANSLATION_CAP)
  assert.equal(DEFAULT_SESSION_TRANSLATION_CAP, 150)
})

test('an env override wins, so the number is tunable without a deploy of new code', () => {
  process.env[TRANSLATION_CAP_ENV] = '80'
  assert.equal(sessionTranslationCap(), 80)
})

test('0 is a real value, not "unset" — it disables translation entirely', () => {
  // Relevant because Noam's adaptive idea ends at "level 5 gets no translation".
  process.env[TRANSLATION_CAP_ENV] = '0'
  assert.equal(sessionTranslationCap(), 0)
})

test('a malformed override falls back instead of throwing', () => {
  // A typo in an env var must not 500 every translate request.
  for (const bad of ['', '   ', 'abc', '-5', '12.5', 'NaN']) {
    process.env[TRANSLATION_CAP_ENV] = bad
    assert.equal(sessionTranslationCap(), DEFAULT_SESSION_TRANSLATION_CAP, `input ${JSON.stringify(bad)}`)
  }
})
