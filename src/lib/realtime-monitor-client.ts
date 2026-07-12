export type MonitorConnectionState = 'connecting' | 'connected' | 'disconnected'

export function classroomMonitorTopic(classId: number, lessonGroup: number | null): string {
  return lessonGroup !== null ? `class:${classId}:group:${lessonGroup}` : `class:${classId}:all`
}

export function mapMonitorChannelStatus(status: string): MonitorConnectionState | null {
  if (status === 'SUBSCRIBED') return 'connected'
  if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') return 'disconnected'
  return null
}

export interface MonitorSubscriptionHandlers {
  onBroadcast(payload: unknown): void
  onStatusChange(state: MonitorConnectionState): void
}

interface MinimalRealtimeChannel {
  on(event: 'broadcast', filter: { event: string }, cb: (msg: { payload: unknown }) => void): MinimalRealtimeChannel
  subscribe(cb: (status: string) => void): MinimalRealtimeChannel
}

interface MinimalSession {
  access_token: string
}

export interface MinimalSupabaseClient {
  auth: {
    getSession(): Promise<{ data: { session: MinimalSession | null } }>
    onAuthStateChange(
      cb: (event: string, session: MinimalSession | null) => void
    ): { data: { subscription: { unsubscribe(): void } } }
  }
  realtime: { setAuth(token: string | null): void }
  channel(topic: string, opts: { config: { private: true } }): MinimalRealtimeChannel
  removeChannel(channel: MinimalRealtimeChannel): void
}

/**
 * Establishes a private Realtime Broadcast subscription with the auth token
 * attached BEFORE subscribing. Private broadcast channels are authorized by
 * an RLS policy on realtime.messages evaluated against auth.jwt() (see
 * supabase/migration_fix_realtime_monitor_group_scope.sql) — subscribing
 * before the JWT is attached races the SDK's own async auth hydration and
 * can permanently fail the very first join attempt with no retry, which is
 * exactly what produced a stuck "מנותק" (disconnected) status in practice.
 */
export async function subscribeToClassroomMonitor(
  supabase: MinimalSupabaseClient,
  topic: string,
  handlers: MonitorSubscriptionHandlers
): Promise<() => void> {
  const { data: { session } } = await supabase.auth.getSession()
  supabase.realtime.setAuth(session?.access_token ?? null)

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
    supabase.realtime.setAuth(newSession?.access_token ?? null)
  })

  const channel = supabase.channel(topic, { config: { private: true } })
  channel
    .on('broadcast', { event: 'activity' }, ({ payload }) => handlers.onBroadcast(payload))
    .subscribe(status => {
      const mapped = mapMonitorChannelStatus(status)
      if (mapped) handlers.onStatusChange(mapped)
    })

  return () => {
    subscription.unsubscribe()
    supabase.removeChannel(channel)
  }
}
