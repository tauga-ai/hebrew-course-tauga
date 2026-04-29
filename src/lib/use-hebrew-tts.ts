'use client'

let currentAudio: HTMLAudioElement | null = null

export async function speakHebrew(text: string, rate = 0.95): Promise<void> {
  // Stop any ongoing speech
  stopSpeaking()

  // Try Google Cloud TTS first (proper Hebrew)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      currentAudio = new Audio(url)
      currentAudio.playbackRate = rate / 0.95
      await currentAudio.play()
      return new Promise((resolve, reject) => {
        if (!currentAudio) { resolve(); return }
        currentAudio.onended = () => resolve()
        currentAudio.onerror = (e) => reject(e)
      })
    }
  } catch {
    // Fall through to browser fallback
  }

  // Fallback: browser SpeechSynthesis (depends on installed voices)
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'))
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'he-IL'
    utterance.rate = rate
    const voices = window.speechSynthesis.getVoices()
    const hebrewVoice = voices.find(v => v.lang.startsWith('he'))
    if (hebrewVoice) utterance.voice = hebrewVoice
    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
