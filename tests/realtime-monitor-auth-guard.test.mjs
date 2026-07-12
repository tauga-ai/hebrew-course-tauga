// Guard test: LiveMonitorBoard must establish its private Realtime Broadcast
// subscription through subscribeToClassroomMonitor() rather than building a
// raw channel(...).subscribe(...) inline — the inline version is exactly
// what shipped without attaching the auth JWT first, producing a stuck
// "מנותק" (disconnected) status. This guards against a future edit quietly
// reverting to that racy pattern.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC_DIR = join(import.meta.dirname, '..', 'src')

test('LiveMonitorBoard subscribes via subscribeToClassroomMonitor, not a raw inline channel().subscribe()', () => {
  const content = readFileSync(join(SRC_DIR, 'components', 'teacher', 'LiveMonitorBoard.tsx'), 'utf-8')

  assert.match(
    content,
    /subscribeToClassroomMonitor/,
    'LiveMonitorBoard.tsx must import and call subscribeToClassroomMonitor from @/lib/realtime-monitor-client'
  )
  assert.doesNotMatch(
    content,
    /supabase\.channel\(/,
    'LiveMonitorBoard.tsx must not construct a raw supabase.channel(...) itself — that bypasses the auth-before-subscribe fix'
  )
})

test('subscribeToClassroomMonitor attaches auth (setAuth) before calling .subscribe(', () => {
  const content = readFileSync(join(SRC_DIR, 'lib', 'realtime-monitor-client.ts'), 'utf-8')

  const setAuthIndex = content.indexOf('realtime.setAuth(session')
  const subscribeIndex = content.indexOf('.subscribe(status =>')

  assert.ok(setAuthIndex !== -1, 'expected an initial realtime.setAuth(session...) call in subscribeToClassroomMonitor')
  assert.ok(subscribeIndex !== -1, 'expected a channel.subscribe(status => ...) call in subscribeToClassroomMonitor')
  assert.ok(setAuthIndex < subscribeIndex, 'realtime.setAuth() must be called before channel.subscribe()')
})
