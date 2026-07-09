'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal shape of the Web Speech API surface this hook actually touches.
// Written locally instead of relying on `any` — TS's DOM lib does not ship these types.
interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

interface UseSpeechToTextOptions {
  /** Called with the recognized text on every result event. */
  onTranscript: (text: string) => void
  /** Keep listening past the first pause. Defaults to true. */
  continuous?: boolean
  /** If true, new speech is appended to the text passed into `start()` instead of replacing it. */
  appendMode?: boolean
}

/**
 * Wraps the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition) for Hebrew (he-IL) dictation.
 * `stop()` detaches the recognition callbacks before calling `.stop()` so a result event that fires
 * after stopping (e.g. right after navigating to the next question) can't overwrite state that
 * was already reset — see `acceptRef`.
 */
export function useSpeechToText({ onTranscript, continuous = true, appendMode = false }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseTextRef = useRef('')
  const acceptRef = useRef(true)

  const supported = typeof window !== 'undefined' && !!getSpeechRecognitionCtor()

  function start(currentText = '') {
    const SR = typeof window !== 'undefined' ? getSpeechRecognitionCtor() : undefined
    if (!SR) return

    acceptRef.current = true
    baseTextRef.current = appendMode ? currentText.trim() : ''

    const rec = new SR()
    rec.lang = 'he-IL'
    rec.continuous = continuous
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onresult = (e) => {
      if (!acceptRef.current) return
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      const base = baseTextRef.current
      onTranscript(base ? `${base} ${transcript}` : transcript)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start()
    setIsListening(true)
  }

  const stop = useCallback(() => {
    acceptRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // Stops any live recognition on unmount (e.g. navigating away mid-dictation)
  // — without this, the mic stayed active and callbacks kept firing into a
  // component instance that no longer exists. stop() is already a no-op if
  // nothing is listening, so this is safe on every mount/unmount, including
  // React 18 StrictMode's dev double-invoke.
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { isListening, start, stop, supported }
}
