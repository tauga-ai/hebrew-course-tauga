import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for Client Components ('use client').
 * Stores the session in cookies (not localStorage), so it's visible to
 * server-side getUser() checks in API routes and proxy.ts.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
