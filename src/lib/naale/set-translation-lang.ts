export type TranslationLang = 'ru' | 'ar'

/**
 * Saves the student's hover-translation language, returning whether it stuck.
 *
 * The pre-session sheet is the only caller: the sidebar's flag toggle was
 * removed once the sheet took over the choice. Kept as its own module rather
 * than inlined because the return value is the point — the sidebar version
 * fired this request and ignored the result, so a failed save showed the
 * student one language while the server kept translating into the other.
 */
export async function setTranslationLang(lang: TranslationLang): Promise<boolean> {
  try {
    const res = await fetch('/api/naale/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translation_lang: lang }),
    })
    return res.ok
  } catch {
    return false
  }
}
