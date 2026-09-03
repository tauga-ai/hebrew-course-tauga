const PICTURE_DESCRIPTION_TOPIC = 'תיאור תמונה בקול'

/**
 * Warms the browser's cache for a picture-description question's image ahead of time, so the
 * real <img src="/api/naale/pictures/{n}"> later hits an instant cache hit instead of a fresh
 * network request. Called from the same spot session/page.tsx and placement/page.tsx already
 * prefetch the next question's metadata — a fire-and-forget side effect, never throws, never
 * blocks: this is a pure optimization, and a failure here (slow network, request dropped) must
 * never surface to the student or affect the real <img>'s own normal load.
 */
export function prefetchPictureImage(question: { topic: string; fields?: Record<string, string> } | null | undefined) {
  if (typeof window === 'undefined') return
  if (question?.topic !== PICTURE_DESCRIPTION_TOPIC) return
  const pictureNumber = question.fields?.picture_number
  if (!pictureNumber) return
  new Image().src = `/api/naale/pictures/${pictureNumber}`
}
