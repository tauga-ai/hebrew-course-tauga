const LISTENING_TOPIC = 'הבנת הנשמע'

/**
 * Warms the browser's HTTP cache for a listening-comprehension question's
 * audio clip ahead of time, so by the time the student actually reaches the
 * question, `<audio src="/api/naale/audio/{n}">` hits a cache hit instead of
 * a fresh request. The audio route downloads the whole clip from Storage
 * server-side before it can respond at all, which is slow enough to visibly
 * eat into a timed session if it only starts once the question is already on
 * screen. Same call site and fire-and-forget reasoning as
 * prefetchPictureImage: never throws, never blocks, a failure here (slow
 * network, request dropped) must never surface to the student.
 */
export function prefetchListeningAudio(
  question:
    | { topic: string; kind?: string; audio_file_name?: string | null; fields?: Record<string, string> }
    | null
    | undefined
) {
  if (typeof window === 'undefined') return
  if (question?.topic !== LISTENING_TOPIC) return
  const raw = question.kind === 'mcq' ? question.audio_file_name : question.fields?.audio_file_name
  const clipNumber = raw?.match(/\d+/)?.[0]
  if (!clipNumber) return
  fetch(`/api/naale/audio/${clipNumber}`, { credentials: 'same-origin' }).catch(() => {})
}
