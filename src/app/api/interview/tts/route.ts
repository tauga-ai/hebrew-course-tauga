import { NextRequest, NextResponse } from 'next/server'

const VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel — multilingual

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'טקסט חסר' }, { status: 400 })

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.55, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const audio = await res.arrayBuffer()
  return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
}
