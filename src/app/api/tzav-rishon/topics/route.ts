import { NextResponse } from 'next/server'
import { TOPICS } from '@/lib/tzav-rishon'

/** Public content — the 4-topic registry (labels + dynamic counts), needed by the client-side topic picker and practice pages (both are 'use client', so they can't import the server-only-guarded data module directly). */
export async function GET() {
  return NextResponse.json({ topics: TOPICS })
}
