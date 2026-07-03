import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveDraft, loadDraft, clearDraft } from '../src/lib/draft-storage'

// Minimal in-memory localStorage mock — Node has no browser storage global.
// Safe to install after the import: draft-storage.ts only touches
// `localStorage` inside its function bodies, never at module load time.
class MemoryStorage {
  private store = new Map<string, string>()
  setItem(key: string, value: string) { this.store.set(key, value) }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  removeItem(key: string) { this.store.delete(key) }
}

const globalWithStorage = globalThis as unknown as { localStorage: MemoryStorage }
globalWithStorage.localStorage = new MemoryStorage()

test('saveDraft + loadDraft: round-trips an object', () => {
  saveDraft('k1', { a: 1, b: 'x' })
  assert.deepEqual(loadDraft('k1'), { a: 1, b: 'x' })
})

test('loadDraft: returns null for a missing key', () => {
  assert.equal(loadDraft('does-not-exist'), null)
})

test('clearDraft: removes a saved draft', () => {
  saveDraft('k2', { a: 1 })
  clearDraft('k2')
  assert.equal(loadDraft('k2'), null)
})

test('saveDraft: overwrites a previous value under the same key', () => {
  saveDraft('k3', { a: 1 })
  saveDraft('k3', { a: 2 })
  assert.deepEqual(loadDraft('k3'), { a: 2 })
})

test('loadDraft: does not throw on corrupted JSON in storage', () => {
  globalWithStorage.localStorage.setItem('k4', 'not valid json{{{')
  assert.equal(loadDraft('k4'), null)
})
