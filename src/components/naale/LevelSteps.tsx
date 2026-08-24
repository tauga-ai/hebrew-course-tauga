/** Tone for the filled steps. `accent` is the default everywhere; the other
 *  two exist for /naale/stats, where the level track is the row's only mark
 *  and has to carry "this topic needs attention" as well as "level N". */
export type LevelTone = 'accent' | 'warn' | 'bad'

const FILL: Record<LevelTone, string> = {
  accent: 'bg-accent-naale',
  warn: 'bg-warning-500',
  bad: 'bg-red-500 dark:bg-red-400',
}

interface LevelStepsProps {
  level: number
  locked?: boolean
  /** `track` renders the five steps as a full-width segmented bar instead of
   *  a fixed row of dots — for /naale/stats, where the level IS the row's
   *  primary mark rather than a small badge sitting beside a "רמה N" label.
   *  Dots stay the default so the home, staff and recap screens are
   *  untouched. */
  variant?: 'dots' | 'track'
  tone?: LevelTone
  /** Supply when no adjacent text states the level. Without it the steps stay
   *  aria-hidden, which is correct where a "רמה N" label already says it and
   *  announcing both would just be noise. */
  label?: string
}

/** Small filled/unfilled step row — level N out of 5, or all-unfilled when locked. */
export function LevelSteps({ level, locked, variant = 'dots', tone = 'accent', label }: LevelStepsProps) {
  const track = variant === 'track'
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true }

  return (
    <span className={`flex items-center gap-0.5 ${track ? 'w-full' : ''}`} {...a11y}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`${
            track
              ? 'flex-1 h-2.5 rounded-xs first:rounded-s-full last:rounded-e-full'
              : 'w-2.5 h-2.5 rounded-full'
          } ${!locked && i < level ? FILL[tone] : 'bg-gray-200 dark:bg-white/10'}`}
        />
      ))}
    </span>
  )
}

/** Below this a topic is called out as needing work, not just shown. */
const WEAK_PCT = 25
const OK_PCT = 50

/**
 * Tone for a topic's level track, from its accuracy.
 *
 * Deliberately NOT scoreColor()'s default palette. That palette's green
 * (#16a34a) measures ΔE 10.8 against this app's own teal accent (#0d9488) —
 * below the 15 floor, i.e. genuinely hard to tell apart with full colour
 * vision, never mind colour-blind. Two marks that mean different things can't
 * be two colours nobody can separate.
 *
 * So green is dropped here and colour is reserved for what needs attention: a
 * healthy topic is simply the accent, and only a weak one is tinted. Amber is
 * warning-500 (#f59e0b), which clears the CVD separation check against both
 * teal and red — but at 2.09:1 it fails text contrast, which is why it only
 * ever colours the bar and never a number.
 *
 * Scoped to the Naale progress screens rather than changed in score-color.ts,
 * which ~20 other screens share — repainting the teacher dashboard is its own
 * decision.
 */
export function topicTone(pct: number | null): LevelTone {
  if (pct === null || pct >= OK_PCT) return 'accent'
  if (pct >= WEAK_PCT) return 'warn'
  return 'bad'
}
