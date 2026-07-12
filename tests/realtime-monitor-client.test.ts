import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classroomMonitorTopic,
  mapMonitorChannelStatus,
  subscribeToClassroomMonitor,
  type MinimalSupabaseClient,
} from '../src/lib/realtime-monitor-client'

test('classroomMonitorTopic: whole-class scope when lessonGroup is null', () => {
  assert.equal(classroomMonitorTopic(5, null), 'class:5:all')
})

test('classroomMonitorTopic: group scope when lessonGroup is set', () => {
  assert.equal(classroomMonitorTopic(5, 2), 'class:5:group:2')
})

test('mapMonitorChannelStatus: SUBSCRIBED maps to connected', () => {
  assert.equal(mapMonitorChannelStatus('SUBSCRIBED'), 'connected')
})

test('mapMonitorChannelStatus: TIMED_OUT/CLOSED/CHANNEL_ERROR map to disconnected', () => {
  assert.equal(mapMonitorChannelStatus('TIMED_OUT'), 'disconnected')
  assert.equal(mapMonitorChannelStatus('CLOSED'), 'disconnected')
  assert.equal(mapMonitorChannelStatus('CHANNEL_ERROR'), 'disconnected')
})

test('mapMonitorChannelStatus: unknown status maps to null (no state change)', () => {
  assert.equal(mapMonitorChannelStatus('JOINING'), null)
})

/**
 * A minimal fake matching the exact shape subscribeToClassroomMonitor
 * consumes, recording call order so the auth-before-subscribe ordering
 * (the actual bug this module fixes) can be asserted directly.
 */
function makeMockSupabase(opts: { token: string | null }) {
  const calls: string[] = []
  const setAuthTokens: (string | null)[] = []
  let authStateCb: ((event: string, session: { access_token: string } | null) => void) | null = null
  let subscribeStatusCb: ((status: string) => void) | null = null
  let broadcastCb: ((msg: { payload: unknown }) => void) | null = null
  let unsubscribeCalls = 0
  let removeChannelCalls = 0

  const channel = {
    on(_event: 'broadcast', _filter: { event: string }, cb: (msg: { payload: unknown }) => void) {
      broadcastCb = cb
      return channel
    },
    subscribe(cb: (status: string) => void) {
      calls.push('subscribe')
      subscribeStatusCb = cb
      return channel
    },
  }

  const supabase: MinimalSupabaseClient = {
    auth: {
      async getSession() {
        return { data: { session: opts.token ? { access_token: opts.token } : null } }
      },
      onAuthStateChange(cb) {
        authStateCb = cb
        return { data: { subscription: { unsubscribe: () => { unsubscribeCalls++ } } } }
      },
    },
    realtime: {
      setAuth(token) {
        calls.push('setAuth')
        setAuthTokens.push(token)
      },
    },
    channel() {
      return channel
    },
    removeChannel() {
      removeChannelCalls++
    },
  }

  return {
    supabase,
    calls,
    setAuthTokens,
    fireAuthStateChange: (token: string | null) => authStateCb?.('TOKEN_REFRESHED', token ? { access_token: token } : null),
    fireStatus: (status: string) => subscribeStatusCb?.(status),
    fireBroadcast: (payload: unknown) => broadcastCb?.({ payload }),
    unsubscribeCalls: () => unsubscribeCalls,
    removeChannelCalls: () => removeChannelCalls,
  }
}

test('subscribeToClassroomMonitor: attaches auth via setAuth before subscribing', async () => {
  const mock = makeMockSupabase({ token: 'jwt-123' })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: () => {},
  })
  assert.deepEqual(mock.calls, ['setAuth', 'subscribe'])
  assert.deepEqual(mock.setAuthTokens, ['jwt-123'])
})

test('subscribeToClassroomMonitor: still calls setAuth(null) and subscribes when there is no session', async () => {
  const mock = makeMockSupabase({ token: null })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: () => {},
  })
  assert.deepEqual(mock.calls, ['setAuth', 'subscribe'])
  assert.deepEqual(mock.setAuthTokens, [null])
})

test('subscribeToClassroomMonitor: re-applies auth when the session token refreshes', async () => {
  const mock = makeMockSupabase({ token: 'jwt-123' })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: () => {},
  })
  mock.fireAuthStateChange('jwt-456')
  assert.deepEqual(mock.setAuthTokens, ['jwt-123', 'jwt-456'])
})

test('subscribeToClassroomMonitor: forwards broadcast payloads verbatim', async () => {
  const received: unknown[] = []
  const mock = makeMockSupabase({ token: 'jwt-123' })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: payload => received.push(payload),
    onStatusChange: () => {},
  })
  mock.fireBroadcast({ studentId: 's1', label: 'סט 1' })
  assert.deepEqual(received, [{ studentId: 's1', label: 'סט 1' }])
})

test('subscribeToClassroomMonitor: maps SUBSCRIBED/CHANNEL_ERROR to connected/disconnected', async () => {
  const states: string[] = []
  const mock = makeMockSupabase({ token: 'jwt-123' })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: state => states.push(state),
  })
  mock.fireStatus('SUBSCRIBED')
  mock.fireStatus('CHANNEL_ERROR')
  assert.deepEqual(states, ['connected', 'disconnected'])
})

test('subscribeToClassroomMonitor: does not call onStatusChange for an unmapped status', async () => {
  const states: string[] = []
  const mock = makeMockSupabase({ token: 'jwt-123' })
  await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: state => states.push(state),
  })
  mock.fireStatus('JOINING')
  assert.deepEqual(states, [])
})

test('subscribeToClassroomMonitor: returned cleanup unsubscribes auth listener and removes the channel exactly once', async () => {
  const mock = makeMockSupabase({ token: 'jwt-123' })
  const cleanup = await subscribeToClassroomMonitor(mock.supabase, 'class:1:all', {
    onBroadcast: () => {},
    onStatusChange: () => {},
  })
  cleanup()
  assert.equal(mock.unsubscribeCalls(), 1)
  assert.equal(mock.removeChannelCalls(), 1)
})
