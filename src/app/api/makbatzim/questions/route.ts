import { NextRequest, NextResponse } from 'next/server'
import { getSetQuestions } from '@/lib/makbatzim'

/**
 * Public content — no student identity needed (same as /api/tzav-rishon/questions).
 * `correctOption` is stripped before responding: defense in depth, since the
 * real trust boundary is server-side grading on submit, not this route.
 */
export async function GET(req: NextRequest) {
  const setId = req.nextUrl.searchParams.get('set_id')
  if (!setId) return NextResponse.json({ error: 'missing set_id' }, { status: 400 })

  const questions = getSetQuestions(setId)
  if (!questions) return NextResponse.json({ error: 'unknown set_id' }, { status: 404 })

  const withoutAnswers = questions.map(q => ({
    id: q.id,
    question: q.question,
    imageUrl: q.imageUrl,
    options: q.options,
  }))
  return NextResponse.json({ questions: withoutAnswers })
}
