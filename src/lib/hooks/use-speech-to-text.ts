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
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
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

// How long a start() attempt waits for a first onresult before giving up and
// reporting 'silent-timeout' — the Opera/Brave/Vivaldi case: the API exists,
// recognition "starts," but the backend behind it isn't authorized for
// non-Google Chromium builds, so neither onresult nor onerror ever fires.
// Both call sites use continuous: false (a single utterance, not a
// multi-minute session), so 8s is well past how long a real student takes to
// start talking after clicking record.
const NO_PROGRESS_TIMEOUT_MS = 8000

interface UseSpeechToTextOptions {
  /** Called with the recognized text on every result event. */
  onTranscript: (text: string) => void
  /** Keep listening past the first pause. Defaults to true. */
  continuous?: boolean
  /** If true, new speech is appended to the text passed into `start()` instead of replacing it. */
  appendMode?: boolean
  /** BCP-47 recognition language. Defaults to 'he-IL' — every real exercise grades Hebrew
   *  speech, so this should only ever be overridden for QA (e.g. a developer testing in English
   *  without speaking Hebrew), never for a real student's session. */
  lang?: string
  /** Called once per start() attempt that fails to produce a transcript — either a real
   *  Web Speech API error code (e.g. 'not-allowed', 'network', 'audio-capture'), or the
   *  synthetic 'silent-timeout' when NO_PROGRESS_TIMEOUT_MS passes with zero onresult events. */
  onError?: (code: string) => void
}

/**
 * Wraps the browser Web Speech API (SpeechRecognition / webkitSpeechRecognition) for Hebrew (he-IL) dictation.
 * `stop()` detaches the recognition callbacks before calling `.stop()` so a result event that fires
 * after stopping (e.g. right after navigating to the next question) can't overwrite state that
 * was already reset — see `acceptRef`.
 */
export function useSpeechToText({ onTranscript, continuous = true, appendMode = false, lang = 'he-IL', onError }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseTextRef = useRef('')
  const acceptRef = useRef(true)
  const gotResultRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supported = typeof window !== 'undefined' && !!getSpeechRecognitionCtor()

  function clearProgressTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function start(currentText = '') {
    const SR = typeof window !== 'undefined' ? getSpeechRecognitionCtor() : undefined
    if (!SR) return

    acceptRef.current = true
    baseTextRef.current = appendMode ? currentText.trim() : ''
    gotResultRef.current = false

    const rec = new SR()
    rec.lang = lang
    rec.continuous = continuous
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onresult = (e) => {
      if (!acceptRef.current) return
      gotResultRef.current = true
      clearProgressTimeout()
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      const base = baseTextRef.current
      onTranscript(base ? `${base} ${transcript}` : transcript)
    }
    rec.onerror = (e) => {
      setIsListening(false)
      clearProgressTimeout()
      onError?.(e.error)
    }
    rec.onend = () => setIsListening(false)
    rec.start()
    setIsListening(true)

    clearProgressTimeout()
    timeoutRef.current = setTimeout(() => {
      if (acceptRef.current && !gotResultRef.current) {
        onError?.('silent-timeout')
        stop()
      }
    }, NO_PROGRESS_TIMEOUT_MS)
  }

  const stop = useCallback(() => {
    acceptRef.current = false
    clearProgressTimeout()
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
