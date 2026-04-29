import { NextRequest, NextResponse } from 'next/server'

// Google Cloud Text-to-Speech — proper Hebrew support via he-IL voices
export async function POST(req: NextRequest) {
  const { text, voice = 'he-IL-Wavenet-D' } = await req.json()
  if (!text) return NextResponse.json({ error: 'טקסט חסר' }, { status: 400 })

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'he-IL', name: voice },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.95,
          pitch: 0.0,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('Google TTS error:', err)
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  if (!data.audioContent) {
    return NextResponse.json({ error: 'אין תוכן אודיו' }, { status: 500 })
  }

  // Decode base64 to binary
  const audioBuffer = Buffer.from(data.audioContent, 'base64')
  return new Response(audioBuffer, { headers: { 'Content-Type': 'audio/mpeg' } })
}
