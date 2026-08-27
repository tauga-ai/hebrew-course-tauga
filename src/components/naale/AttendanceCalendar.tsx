'use client'

import { useMemo, useState } from 'react'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { buildAttendanceMonth, firstSessionMonth, WEEK_START_DAY } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

type SessionKind = 'practice' | 'topic'

/**
 * Sunday-first, rotated by WEEK_START_DAY at render so that constant stays the
 * single source of truth for both this header and the grid's leading blanks.
 *
 * These ARE the Hebrew day names. Hebrew numbers its days rather than naming
 * them — יום ראשון ("first day") is Sunday, יום שני ("second day") is Monday,
 * and so on to שבת (Saturday), the only one with a name of its own. The
 * single letter plus geresh is the standard abbreviation every Israeli
 * calendar uses, so it reads to this audience the way "Mon" does in English.
 *
 * Run through t() so the dev English toggle shows S/M/T/W/T/F/S instead of
 * Hebrew letters — the grid is unreadable in English mode otherwise.
 */
const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

/**
 * A student's practice cadence as a month of day cells.
 *
 * Replaces AttendanceStrip's rolling 28-day run, per Noam (2026-08-27): a
 * named month plus navigation, so staff can see history beyond the last four
 * weeks. It keeps what the strip got right — empty days stay visible as cells,
 * because the gaps are what a counselor is actually looking for, and intensity
 * is carried by one hue at three steps rather than by a second colour (see
 * LevelSteps: success-green sits ΔE 10.8 from the Naale teal accent, below
 * this codebase's 15 separation floor).
 *
 * Weekday alignment is the thing a strip could not do: "this student only ever
 * practises on Sundays and Tuesdays" is readable off a grid and invisible in a
 * continuous run.
 *
 * The type toggle is also Noam's, and his reasoning was about clutter rather
 * than data: a student doing both session kinds on one day would otherwise
 * collapse into a single mark that means two different things. Toggling shows
 * one kind at a time instead of trying to encode both.
 */
export function AttendanceCalendar({
  sessions,
  now,
}: {
  sessions: { id: string; started_at: string; kind: string }[]
  now: Date
}) {
  const [kind, setKind] = useState<SessionKind>('practice')
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })
  // Two separate pieces of state, not one: hover is transient and must not
  // survive the pointer leaving, while a click pins a day so it stays readable
  // on a phone, where there is no hover at all. The readout below prefers
  // hovered when both are set, so moving the pointer previews without
  // destroying the pinned selection.
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Month and type are independent state: changing one must not reset the
  // other, or a counselor comparing March across both kinds gets thrown back
  // to today every time they toggle.
  const filtered = useMemo(() => sessions.filter(s => s.kind === kind), [sessions, kind])
  const days = useMemo(
    () => buildAttendanceMonth(filtered, view.year, view.month, now),
    [filtered, view, now]
  )

  // Bounds come from ALL sessions, not the filtered set. Deriving them from
  // the filtered list would let a toggle strand the viewer on a month the
  // arrows then refuse to leave — e.g. viewing March topic sessions when the
  // student's first topic session was in April.
  const earliest = useMemo(() => firstSessionMonth(sessions), [sessions])
  const atEarliest = !earliest || (view.year === earliest.year && view.month === earliest.month)
  const atLatest = view.year === now.getFullYear() && view.month === now.getMonth()

  const total = days.reduce((n, d) => n + d.count, 0)
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  })

  // Hover wins over the pinned selection, so moving the pointer previews other
  // days without discarding what was clicked — the click comes back the moment
  // the pointer leaves.
  const activeLabel = hovered ?? selected
  const activeDay = activeLabel ? days.find(d => d.label === activeLabel) ?? null : null

  // A day label from the month or kind we just left would otherwise sit in the
  // readout describing data no longer on screen.
  function clearDaySelection() {
    setHovered(null)
    setSelected(null)
  }

  function shift(delta: number) {
    clearDaySelection()
    setView(v => {
      const d = new Date(v.year, v.month, 1)
      d.setMonth(d.getMonth() + delta)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <section className="bg-surface rounded-2xl shadow-sm border border-card-border p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-fg/70">{t('נוכחות')}</h2>
        <span className="text-xs text-fg/60 tabular-nums">
          <LtrIsolate>{String(total)}</LtrIsolate> <span className="text-fg/40">{t('תרגולים')}</span>
        </span>
      </div>

      {/* Segmented rather than a switch: two named states read better than an
          on/off affordance where neither kind is a default. */}
      <div className="flex gap-1 p-1 mb-3 rounded-xl bg-fg/5">
        {(['practice', 'topic'] as SessionKind[]).map(k => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => { clearDaySelection(); setKind(k) }}
            className={`flex-1 min-h-[44px] text-xs font-medium rounded-lg px-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale ${
              kind === k ? 'bg-surface text-fg shadow-sm' : 'text-fg/50 hover:text-fg/70'
            }`}
          >
            {k === 'practice' ? t('תרגולים מלאים') : t('תרגולים קצרים')}
          </button>
        ))}
      </div>

      {/* In RTL, "back" points RIGHT. The back control sits at the reading
          start, matching the grid below it, where the earliest day of the week
          is also at the reading start. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atEarliest}
          aria-label={t('חודש קודם')}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-fg/60 hover:bg-fg/5 disabled:opacity-30 disabled:hover:bg-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale"
        >
          →
        </button>
        <span className="text-xs font-semibold text-fg/70">
          <LtrIsolate>{monthLabel}</LtrIsolate>
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atLatest}
          aria-label={t('חודש הבא')}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-fg/60 hover:bg-fg/5 disabled:opacity-30 disabled:hover:bg-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale"
        >
          ←
        </button>
      </div>

      {/* dir="rtl" on the grid itself: a CSS grid does not inherit the
          flex-row-reverse trick the old strip used, and without this the week
          would run left-to-right inside an otherwise right-to-left page. */}
      <div dir="rtl">
        <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden>
          {WEEKDAY_LABELS.map((_, i) => (
            <span key={i} className="text-[10px] text-center text-fg/40">
              {t(WEEKDAY_LABELS[(i + WEEK_START_DAY) % 7])}
            </span>
          ))}
        </div>

        {/* role="img" is gone: the cells are now individually focusable
            buttons, so the grid is a set of controls rather than one picture,
            and an aria-label on the container would fight their own names. */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) =>
            day.label === null ? (
              <span key={`blank-${i}`} aria-hidden />
            ) : (
              <button
                key={day.label}
                type="button"
                aria-pressed={selected === day.label}
                aria-label={dayLabel(day.label, day.count)}
                onClick={() => setSelected(selected === day.label ? null : day.label)}
                onMouseEnter={() => setHovered(day.label)}
                onMouseLeave={() => setHovered(h => (h === day.label ? null : h))}
                onFocus={() => setHovered(day.label)}
                onBlur={() => setHovered(h => (h === day.label ? null : h))}
                className={`aspect-square rounded-sm flex items-center justify-center text-[10px] tabular-nums transition focus:outline-none ${cellClass(
                  day.count
                )} ${ringClass(day.label === selected, day.label === hovered, day.isToday)}`}
              >
                <LtrIsolate>{String(day.dayOfMonth)}</LtrIsolate>
              </button>
            )
          )}
        </div>
      </div>

      {/* One readout for both interactions. A native title= tooltip was the
          previous answer to "what day is this" and served neither case: ~1s
          delay, unstyleable, and absent entirely on touch, where hover does
          not exist. Hover previews, click pins, and the pinned value survives
          the pointer leaving so a phone tap still leaves something readable.
          aria-live so a keyboard user hears the day as focus moves.
          min-h reserves the row, otherwise the card jumps as text appears. */}
      <p
        className="mt-3 min-h-[1.25rem] text-xs text-fg/60 text-center"
        aria-live="polite"
      >
        {activeDay ? (
          <>
            <LtrIsolate>{activeDay.label!}</LtrIsolate>
            {' · '}
            {activeDay.count === 0 ? (
              <span className="text-fg/40">{t('אין תרגול ביום זה')}</span>
            ) : (
              <>
                <LtrIsolate>{String(activeDay.count)}</LtrIsolate> {t('תרגולים')}
              </>
            )}
          </>
        ) : (
          <span className="text-fg/30">{t('בחר יום לפרטים')}</span>
        )}
      </p>
    </section>
  )
}

/**
 * One ring at a time, with explicit precedence.
 *
 * Three states want a ring — pinned, pointed-at, and today — and a cell can be
 * all three at once. Concatenating three conditional ring classes leaves which
 * one wins to Tailwind's output order, which is not something to depend on, so
 * this picks one.
 *
 * Pinned beats hovered because the pin is a deliberate act and should stay
 * visible while the pointer wanders. Hovered beats today because it tracks the
 * pointer and needs to feel responsive. Today is the weakest: it is context,
 * not interaction, and it is still readable as the only ring on an untouched
 * grid.
 *
 * Hover is driven from state rather than a `hover:` class on purpose — the
 * same state is set on focus, so a keyboard user walking the month gets the
 * identical ring the mouse gives, and it stays in step with the readout below.
 */
function ringClass(isSelected: boolean, isHovered: boolean, isToday: boolean): string {
  if (isSelected) return 'ring-2 ring-accent-naale'
  if (isHovered) return 'ring-2 ring-accent-naale/60'
  if (isToday) return 'ring-1 ring-accent-naale/50'
  return ''
}

/** The cell's accessible name. Screen readers get the date and the count as
 *  one phrase, because a bare day number in a grid of 31 numbers says nothing
 *  about what it represents. */
function dayLabel(label: string, count: number): string {
  return count === 0 ? `${label} — ${t('אין תרגול ביום זה')}` : `${label} — ${count} ${t('תרגולים')}`
}

/** One hue, three steps — carried over from AttendanceStrip along with its
 *  reasoning. An empty day keeps a track rather than disappearing into the
 *  card, because the gaps are the point of this component. */
function cellClass(count: number): string {
  if (count === 0) return 'bg-gray-200 dark:bg-white/10 text-fg/30'
  if (count === 1) return 'bg-accent-naale/50 text-fg/80'
  return 'bg-accent-naale text-white font-semibold'
}
