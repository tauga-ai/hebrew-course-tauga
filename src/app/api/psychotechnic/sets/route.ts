import { NextResponse } from 'next/server'
import { PSYCHOTECHNIC_SETS_META } from '@/lib/psychotechnic'

/** Public metadata — id/name/questionCount only, no answer key. Mirrors api/tzav-rishon/topics. */
export async function GET() {
  return NextResponse.json({ sets: PSYCHOTECHNIC_SETS_META })
}
