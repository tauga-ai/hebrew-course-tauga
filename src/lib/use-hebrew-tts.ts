'use client'

export function speakHebrew(text: string, rate = 0.85): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'))
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'he-IL'
    utterance.rate = rate
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Try to find a Hebrew voice
    const voices = window.speechSynthesis.getVoices()
    const hebrewVoice = voices.find(v =>
      v.lang.startsWith('he') || v.lang.includes('HE')
    )
    if (hebrewVoice) utterance.voice = hebrewVoice

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)

    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
