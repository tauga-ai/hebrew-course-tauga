/**
 * Generic localStorage draft persistence. Fails silently (storage may be
 * full, disabled, or unavailable during SSR) — draft saving is a UX nicety,
 * never a hard requirement.
 */

export function saveDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore — draft saving is best-effort
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
