'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (seconds < 60) return 'עכשיו'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `לפני ${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  return `לפני ${hours} שעות`
}

/**
 * Subscribes directly to Supabase Realtime from the browser (never proxied
 * through a Next.js API route) on the exact channel matching this teacher's
 * scope — class:{classId}:group:{lessonGroup} for a group-scoped teacher,
 * or class:{classId}:all for a whole-class teacher/admin (lessonGroup is
 * always null on that path). `private: true` is what makes the
 * Broadcast Authorization RLS policy on realtime.messages actually apply.
 *
 * No client-side aggregation ever happens here — every incoming broadcast
 * is a fully-computed ClassroomActivityEvent, merged into state keyed by
 * studentId (never a full refetch), exactly like the initial snapshot.
 */
export function LiveMonitorBoard({ classId, lessonGroup, roster, initialSnapshot }: LiveMonitorBoardProps) {
  const [activity, setActivity] = useState(initialSnapshot)
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  useEffect(() => {
    let cancelled = false

    function mergeEvent(event: ClassroomActivityEvent) {
      setActivity(prev => {
        const existing = prev[event.studentId]
        if (existing && existing.at >= event.at) return prev
        return { ...prev, [event.studentId]: event }
      })
    }

    // Broadcasts missed while disconnected are never replayed to a
    // reconnecting client, so every (re)subscribe re-fetches a fresh
    // snapshot and merges it in — a no-op if nothing was actually missed,
    // since mergeEvent only ever keeps the more recent of the two per student.
    function catchUp() {
      fetch('/api/teacher/monitor/snapshot')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (cancelled || !data?.snapshot) return
          Object.values(data.snapshot as Record<string, ClassroomActivityEvent>).forEach(mergeEvent)
        })
        .catch(() => {})
    }

    const supabase = createClient()
    const topic = lessonGroup !== null ? `class:${classId}:group:${lessonGroup}` : `class:${classId}:all`
    const channel = supabase.channel(topic, { config: { private: true } })

    channel
      .on('broadcast', { event: 'activity' }, ({ payload }) => mergeEvent(payload as ClassroomActivityEvent))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setConnection('connected')
          catchUp()
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnection('disconnected')
        }
      })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [classId, lessonGroup])

  const sorted = [...roster].sort((a, b) => (activity[b.id]?.at ?? 0) - (activity[a.id]?.at ?? 0))

  return (
    <div>
      <div className="mb-3 text-sm">
        {connection === 'connected' && <span className="text-green-600 dark:text-green-400">🟢 חי</span>}
        {connection === 'connecting' && <span className="text-yellow-600 dark:text-yellow-400">🟡 מתחבר...</span>}
        {connection === 'disconnected' && <span className="text-red-600 dark:text-red-400">🔴 מנותק — הנתונים עלולים להיות לא מעודכנים</span>}
      </div>
      <div className="space-y-2">
        {sorted.map(student => {
          const event = activity[student.id]
          return (
            <div key={student.id} className="bg-surface border border-card-border rounded-xl p-4 flex items-center justify-between gap-3">
              <span className="font-semibold text-fg">{student.fullName}</span>
              {event ? (
                <span className="text-sm text-fg/70 text-left">
                  <span className="block">{event.label}{event.detail ? ` · ${event.detail}` : ''}</span>
                  <span className="block text-xs text-fg/40">{timeAgo(event.at)}</span>
                </span>
              ) : (
                <span className="text-sm text-fg/30">אין פעילות עדיין</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
