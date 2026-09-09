import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireNaaleStaff } from '@/lib/naale/auth'

const TABLE_BY_KIND = { mcq: 'naale_questions', open: 'naale_open_questions' } as const
type Kind = keyof typeof TABLE_BY_KIND

function tableFor(kind: string | null): (typeof TABLE_BY_KIND)[Kind] | null {
  return kind === 'mcq' || kind === 'open' ? TABLE_BY_KIND[kind] : null
}

/**
 * Live content for one question, looked up by its row id — used by the
 * report page (naale-report-quick-edit) to show current wording alongside
 * the report's frozen prompt_snapshot. question_row_id has no FK to either
 * table (naale_question_reports migration), so a missing row is an expected
 * outcome (question deleted since reported), not an error.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const table = tableFor(req.nextUrl.searchParams.get('kind'))
  if (!table) return NextResponse.json({ error: 'missing_or_invalid_kind' }, { status: 400 })

  const db = createServiceClient()
  const { data: question } = await db.from(table).select('*').eq('id', id).maybeSingle()
  return NextResponse.json({ question })
}

/**
 * Content-only edit. question_id/topic/difficulty are never read from the
 * body — this route has no way to re-key, re-topic, or re-level a question,
 * by construction rather than by validation (naale-report-quick-edit).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireNaaleStaff()
  if (staff.status === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (staff.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  let body: {
    kind?: string
    prompt?: string
    options?: string[]
    correct_answer?: string
    explanation?: string
    fields?: Record<string, string>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }

  const table = tableFor(body.kind ?? null)
  if (!table) return NextResponse.json({ error: 'missing_or_invalid_kind' }, { status: 400 })

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 })
  }
  if (table === 'naale_questions') {
    if (!Array.isArray(body.options) || body.options.length < 2 || !body.options.includes(body.correct_answer ?? '')) {
      return NextResponse.json({ error: 'שדות לא תקינים' }, { status: 400 })
    }
  }

  const update = table === 'naale_questions'
    ? { prompt: body.prompt, options: body.options, correct_answer: body.correct_answer, explanation: body.explanation ?? '' }
    : { prompt: body.prompt, fields: body.fields ?? {} }

  const db = createServiceClient()
  const { error } = await db.from(table).update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
