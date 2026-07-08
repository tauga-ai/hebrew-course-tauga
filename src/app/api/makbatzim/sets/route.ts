import { NextResponse } from 'next/server'
import { SETS } from '@/lib/makbatzim'

/** Public content — the 6-set registry (labels + dynamic counts), needed by the client-side picker (which is 'use client' and can't import the server-only-guarded data module directly). */
export async function GET() {
  return NextResponse.json({ sets: SETS })
}
