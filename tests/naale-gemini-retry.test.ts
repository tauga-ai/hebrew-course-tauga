import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleGenerativeAIAbortError, GoogleGenerativeAIFetchError } from '@google/generative-ai'
import { isRetryableGeminiError } from '../src/lib/naale/gemini-retry'

test('isRetryableGeminiError: retries a request timeout', () => {
  assert.equal(isRetryableGeminiError(new GoogleGenerativeAIAbortError('timed out')), true)
})

test('isRetryableGeminiError: retries a 503 from Gemini', () => {
  assert.equal(isRetryableGeminiError(new GoogleGenerativeAIFetchError('unavailable', 503, 'Service Unavailable')), true)
})

test('isRetryableGeminiError: retries a 429 from Gemini', () => {
  assert.equal(isRetryableGeminiError(new GoogleGenerativeAIFetchError('rate limited', 429, 'Too Many Requests')), true)
})

test('isRetryableGeminiError: does not retry a 400', () => {
  assert.equal(isRetryableGeminiError(new GoogleGenerativeAIFetchError('bad request', 400, 'Bad Request')), false)
})

test('isRetryableGeminiError: does not retry a malformed-response error', () => {
  assert.equal(isRetryableGeminiError(new Error('Malformed grading response')), false)
})
