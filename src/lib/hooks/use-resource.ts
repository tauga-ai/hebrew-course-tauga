'use client'

import { useEffect, useState } from 'react'

export interface UseResourceOptions<T> {
  fallback?: T
}

export interface UseResourceResult<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetches JSON from `url` and re-fetches whenever `url` changes. Pass `null`
 * to skip fetching (e.g. while a prerequisite session/param isn't ready).
 * Resets `data`/`error` synchronously during render when `url` changes —
 * before any paint — so callers never see a stale response flash under a
 * new URL; this absorbs the render-time reset trick hand-written across
 * several practice pages. A non-ok response is treated as an error, unlike
 * the ad-hoc versions of this pattern elsewhere, which only caught
 * network/parse failures and silently kept stale/empty state on a 500.
 */
export function useResource<T>(url: string | null, opts?: UseResourceOptions<T>): UseResourceResult<T> {
  const fallback = (opts?.fallback ?? null) as T | null
  const [lastUrl, setLastUrl] = useState(url)
  const [data, setData] = useState<T | null>(fallback)
  const [loading, setLoading] = useState(url !== null)
  const [error, setError] = useState<string | null>(null)

  if (url !== lastUrl) {
    setLastUrl(url)
    setData(fallback)
    setError(null)
    setLoading(url !== null)
  }

  useEffect(() => {
    if (url === null) return
    const resolvedUrl = url
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(resolvedUrl)
        if (cancelled) return
        if (!res.ok) throw new Error(`fetch failed with status ${res.status}`)
        const json: T = await res.json()
        if (cancelled) return
        setData(json)
        setLoading(false)
      } catch {
        if (cancelled) return
        setError('שגיאה בטעינת המידע. בדוק חיבור לאינטרנט ונסה שוב.')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [url])

  return { data, loading, error }
}
