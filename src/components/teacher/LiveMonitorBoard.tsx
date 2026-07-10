'use client'

import type { ClassroomActivityEvent } from '@/lib/realtime-broadcast'

export interface MonitorRosterStudent {
  id: string
  fullName: string
  lessonGroup: number | null
}

export interface LiveMonitorBoardProps {
  classId: number
  lessonGroup: number | null
  roster: MonitorRosterStudent[]
  initialSnapshot: Record<string, ClassroomActivityEvent>
}

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (seconds < 60) return 'עכשיו'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `לפני ${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  return `לפני ${hours} שעות`
}

/**
 * RT7 stub: renders the server-loaded snapshot statically, no live updates
 * yet — RT8 adds the realtime subscription, per-student state merging, and
 * the connection-status indicator on top of this same rendering.
 */
export function LiveMonitorBoard({ roster, initialSnapshot }: LiveMonitorBoardProps) {
  const sorted = [...roster].sort((a, b) => {
    const at = initialSnapshot[a.id]?.at ?? 0
    const bt = initialSnapshot[b.id]?.at ?? 0
    return bt - at
  })

  return (
    <div className="space-y-2">
      {sorted.map(student => {
        const activity = initialSnapshot[student.id]
        return (
          <div key={student.id} className="bg-surface border border-card-border rounded-xl p-4 flex items-center justify-between gap-3">
            <span className="font-semibold text-fg">{student.fullName}</span>
            {activity ? (
              <span className="text-sm text-fg/70 text-left">
                <span className="block">{activity.label}{activity.detail ? ` · ${activity.detail}` : ''}</span>
                <span className="block text-xs text-fg/40">{timeAgo(activity.at)}</span>
              </span>
            ) : (
              <span className="text-sm text-fg/30">אין פעילות עדיין</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
