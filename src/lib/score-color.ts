export interface ScoreColorOptions {
  thresholds?: { good: number; ok: number }
  palette?: { good: string; ok: string; bad: string }
  emptyClass?: string
}

const DEFAULT_THRESHOLDS = { good: 70, ok: 50 }
const DEFAULT_PALETTE = {
  good: 'text-green-600 dark:text-green-400',
  ok: 'text-yellow-600 dark:text-yellow-400',
  bad: 'text-red-500 dark:text-red-400',
}
const DEFAULT_EMPTY_CLASS = 'text-fg/30'

/**
 * Picks a class string for a numeric score. A 2-tier (good/bad, no middle)
 * call site can pass `thresholds: { good: X, ok: X }` — same threshold for
 * both collapses the middle tier away.
 */
export function scoreColor(value: number | null, opts?: ScoreColorOptions): string {
  if (value === null) return opts?.emptyClass ?? DEFAULT_EMPTY_CLASS
  const { good, ok } = opts?.thresholds ?? DEFAULT_THRESHOLDS
  const palette = opts?.palette ?? DEFAULT_PALETTE
  if (value >= good) return palette.good
  if (value >= ok) return palette.ok
  return palette.bad
}
