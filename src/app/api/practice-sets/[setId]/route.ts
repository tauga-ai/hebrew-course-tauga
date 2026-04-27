import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params
  const db = createServiceClient()

  const [setRes, questionsRes] = await Promise.all([
    db.from('practice_sets').select('*').eq('id', setId).single(),
    db.from('questions').select('*').eq('practice_set_id', setId).order('question_order'),
  ])

  if (setRes.error || !setRes.data) {
    return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  }

  return NextResponse.json({ set: setRes.data, questions: questionsRes.data })
}
