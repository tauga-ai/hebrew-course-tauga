'use client'

import { useCallback, useEffect, useState } from 'react'

export type NaaleProfileRole = 'student' | 'staff' | 'admin'

export interface NaaleProfile {
  full_name: string
  avatar_url: string | null
  // Only present for student/staff (the admin profile endpoint has no
  // translation preference) — admin readers just never see it set.
  translation_lang?: 'ru' | 'ar'
  // Same — /api/naale/admin/me has no equivalent flag, since an admin caller
  // is already known to be an admin by virtue of that endpoint accepting them.
  is_admin?: boolean
  // Whether this account has a password identity (vs. Google-only) — gates
  // the change-password section on /naale/profile.
  has_password?: boolean
}

/**
 * Module-level cache shared by every mount in the tab, keyed by role — not a
 * React Context, since this data has exactly one shape of consumer (read-only
 * display) and no component tree needs to inject or override it. Fixes
 * NaaleSidebar, naale/page.tsx, naale/placement/page.tsx, and
 * naale/staff/page.tsx each independently re-fetching the same profile row on
 * every mount, with nothing shared between them.
 */
const cache = new Map<NaaleProfileRole, NaaleProfile | null>()
const inflight = new Map<NaaleProfileRole, Promise<NaaleProfile | null>>()
const listeners = new Map<NaaleProfileRole, Set<() => void>>()

function urlFor(role: NaaleProfileRole) {
  // role='admin' may have no roster/students row at all, so the roster-gated
  // /api/naale/me would 403 it — same reasoning NaaleSidebar used before this
  // hook existed.
  return role === 'admin' ? '/api/naale/admin/me' : '/api/naale/me'
}

async function load(role: NaaleProfileRole): Promise<NaaleProfile | null> {
  try {
    const res = await fetch(urlFor(role))
    if (!res.ok) return null
    const data = await res.json()
    return role === 'admin'
      ? { full_name: data.full_name, avatar_url: data.avatar_url, has_password: data.has_password }
      : {
          full_name: data.student.full_name,
          avatar_url: data.avatar_url,
          translation_lang: data.student.translation_lang,
          is_admin: data.is_admin,
          has_password: data.has_password,
        }
  } catch {
    return null
  }
}

function notify(role: NaaleProfileRole) {
  listeners.get(role)?.forEach(fn => fn())
}

/**
 * Seeds the cache from a fetch a caller already had to do for its own
 * reasons — naale/page.tsx's own `/api/naale/me` read also gates 401/403/
 * staff redirects, which don't belong in this shared hook (some readers,
 * like NaaleSidebar, must never redirect on a failed fetch). Priming here
 * means NaaleSidebar, mounted as that page's child, doesn't redundantly
 * re-fetch what its parent just loaded.
 */
export function primeNaaleProfile(role: NaaleProfileRole, profile: NaaleProfile) {
  cache.set(role, profile)
  notify(role)
}

/**
 * Shared, cached read of the signed-in user's Naale profile. First mount for
 * a given role triggers the fetch; every later mount (same role, same tab)
 * reuses the cached value instead of re-requesting it.
 *
 * `refresh()` bypasses the cache on purpose — naale/staff/page.tsx's
 * openPracticeSheet() needs the freshest translation_lang right before
 * showing the pre-session sheet, not whatever was cached at page load.
 */
export function useNaaleProfile(role: NaaleProfileRole) {
  const [, forceRerender] = useState(0)

  useEffect(() => {
    if (!listeners.has(role)) listeners.set(role, new Set())
    const roleListeners = listeners.get(role)!
    const rerender = () => forceRerender(n => n + 1)
    roleListeners.add(rerender)

    if (!cache.has(role) && !inflight.has(role)) {
      const pending = load(role).then(profile => {
        cache.set(role, profile)
        inflight.delete(role)
        notify(role)
        return profile
      })
      inflight.set(role, pending)
    }

    return () => {
      roleListeners.delete(rerender)
    }
  }, [role])

  // Stable across renders (deps on role only) so a caller can safely put it
  // in a useEffect dependency array — see naale/placement/page.tsx.
  const refresh = useCallback(async (): Promise<NaaleProfile | null> => {
    const profile = await load(role)
    cache.set(role, profile)
    notify(role)
    return profile
  }, [role])

  return {
    profile: cache.get(role) ?? null,
    loading: !cache.has(role),
    refresh,
  }
}
