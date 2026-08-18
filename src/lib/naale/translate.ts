import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const TARGET_LANG = 'ru'

/**
 * Looks up `word`'s translation in the naale_word_translations cache; on a
 * miss, calls Google Cloud Translation (Basic, REST v2 — simple API-key
 * auth, same style as GEMINI_API_KEY's reuse for Google TTS in
 * src/app/api/tts/route.ts, no OAuth/service account needed) and writes
 * the result back so this exact word is never translated twice.
 */
export async function translateWord(db: SupabaseClient, word: string): Promise<string> {
  const { data: cached } = await db
    .from('naale_word_translations')
    .select('translation')
    .eq('source_word', word)
    .eq('target_lang', TARGET_LANG)
    .maybeSingle()

  if (cached) return cached.translation

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: word, source: 'he', target: TARGET_LANG, format: 'text' }),
    }
  )
  if (!res.ok) {
    // Google's actual error body (e.g. "API key not valid", a referrer/IP
    // restriction, or the API not being enabled) is far more useful than the
    // bare status code for telling these apart — surfaced here so
    // console.error in the route logs the real reason, not just "400".
    const body = await res.text().catch(() => '')
    throw new Error(`translate API failed: ${res.status} ${body}`)
  }
  const json = await res.json()
  const translation = json?.data?.translations?.[0]?.translatedText as string | undefined
  if (!translation) throw new Error('translate API returned no result')

  // upsert, not insert: a race with another concurrent first-lookup of the
  // same word hits this unique constraint — ignore the conflict rather than
  // erroring, since both writers have the same correct translation.
  await db
    .from('naale_word_translations')
    .upsert({ source_word: word, target_lang: TARGET_LANG, translation }, { onConflict: 'source_word,target_lang' })

  return translation
}
