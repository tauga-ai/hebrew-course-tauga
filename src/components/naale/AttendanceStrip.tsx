import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { buildAttendanceWindow, ATTENDANCE_DAYS } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

/**
 * A student's practice cadence as one cell per day.
 *
 * The staff detail view used to answer "when did they practice" with a list of
 * dates. A list can only show the days that happened; the gaps between them —
 * the thing a counselor is actually looking for — are invisible. A continuous
 * run of days shows attendance and absence in the same mark, and reads at a
 * glance instead of needing to be counted.
 *
 * Deliberately the only loud element on the page. Intensity is carried by one
 * hue at three steps rather than by a second colour: this is the same reason
 * topicTone() drops green, and it keeps a "practiced twice" day distinguishable
 * from "practiced once" without introducing a mark that means something else
 * elsewhere in the app.
 *
 * Rendered right-to-left so oldest sits at the reading start and today at the
 * reading end, matching the Hebrew page direction.
 */
export function AttendanceStrip({
  sessions,
  now,
}: {
  sessions: { id: string; started_at: string }[]
  now: Date
}) {
  const days = buildAttendanceWindow(sessions, now)
  const practised = days.filter(d => d.count > 0)
  const total = days.reduce((n, d) => n + d.count, 0)
  const lastPractised = practised.length > 0 ? practised[practised.length - 1] : null

  return (
    <section className="bg-surface rounded-2xl shadow-sm border border-card-border p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-fg/70">{t('נוכחות')}</h2>
        <span className="text-[10px] uppercase tracking-wide text-fg/40">
          {t('28 הימים האחרונים')}
        </span>
      </div>

      <div className="flex flex-row-reverse flex-wrap gap-1" role="img" aria-label={attendanceLabel(total, practised.length)}>
        {days.map(day => (
          <span
            key={day.label}
            title={`${day.label} — ${day.count}`}
            className={`h-5 flex-1 min-w-[0.5rem] rounded-sm ${cellClass(day.count)} ${
              day.isToday ? 'ring-1 ring-accent-naale/50' : ''
            }`}
          />
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-3 text-xs">
        <span className="text-fg/40">
          {total === 0 ? (
            t('אין תרגולים עדיין')
          ) : (
            <>
              {t('תרגול אחרון')}{' '}
              <LtrIsolate>{lastPractised!.label}</LtrIsolate>
            </>
          )}
        </span>
        <span className="text-fg/60 tabular-nums">
          <LtrIsolate>{`${total}`}</LtrIsolate>{' '}
          <span className="text-fg/40">{t('תרגולים')}</span>
        </span>
      </div>
    </section>
  )
}

/** One hue, three steps. An empty day has to be visible as a day, so it keeps a
 *  track rather than disappearing into the card. */
function cellClass(count: number): string {
  if (count === 0) return 'bg-gray-200 dark:bg-white/10'
  if (count === 1) return 'bg-accent-naale/50'
  return 'bg-accent-naale'
}

function attendanceLabel(total: number, daysPractised: number): string {
  if (total === 0) return t('אין תרגולים עדיין')
  return `${t('תרגולים')}: ${total}, ${t('ימים')}: ${daysPractised} / ${ATTENDANCE_DAYS}`
}
