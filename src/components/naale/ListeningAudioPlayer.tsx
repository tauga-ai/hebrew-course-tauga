'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/lib/dev-i18n'
import { LTR_ISOLATE_STYLE } from '@/components/tzav-rishon/bidi'

type Status = 'loading' | 'ready' | 'error'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Renders a listening-comprehension question's audio clip with play/pause,
 * unlimited replay, and a custom seek/progress bar — no native `<audio
 * controls>` skin, which looked out of place next to this app's own card
 * styling and duplicated the play/pause affordance. State is intentionally
 * local — same reasoning as PictureDescriptionImage: the session/placement
 * pages remount this component's whole ancestor subtree per question
 * (`key={q.id}`), so a fresh `loading` state comes for free.
 *
 * `audioFileName` is the raw DB value (e.g. "audio_24") — the audio route is
 * keyed by the plain clip number, so the numeric suffix is extracted here
 * rather than assuming callers already stripped the "audio_" prefix.
 */
export function ListeningAudioPlayer({ audioFileName }: { audioFileName: string }) {
  const [status, setStatus] = useState<Status>('loading')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // HTMLMediaElement.play() is async — calling .pause() while that promise is
  // still settling can lose the race in some browsers and leave audio playing
  // despite the button showing "paused". Tracking the in-flight promise and
  // awaiting it before trusting a pause click closes that gap.
  const playPromiseRef = useRef<Promise<void> | null>(null)

  const clipNumber = audioFileName.match(/\d+/)?.[0]

  const seekToClientX = (clientX: number) => {
    const audio = audioRef.current
    const bar = barRef.current
    if (!audio || !bar || !duration || !Number.isFinite(duration)) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  // `volume` isn't a controllable JSX prop on <audio> (unlike `muted`) — it's
  // a DOM property only, so it has to be set imperatively here.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    const next = !audio.muted
    audio.muted = next
    setIsMuted(next)
  }

  const changeVolume = (next: number) => {
    setVolume(next)
    setIsMuted(next === 0)
    const audio = audioRef.current
    if (!audio) return
    audio.volume = next
    audio.muted = next === 0
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current
        } catch {
          // Play was aborted before it started — nothing to pause.
          return
        }
      }
      audio.pause()
    } else {
      playPromiseRef.current = audio.play()
      try {
        await playPromiseRef.current
      } catch {
        // Interrupted by a near-simultaneous pause — onPause already
        // reconciled `isPlaying`, nothing further to do here.
      }
    }
  }

  return (
    <div className="w-full rounded-xl border border-card-border bg-surface p-4 mb-4">
      {status === 'error' || !clipNumber ? (
        <p className="text-sm text-red-700 dark:text-red-400">{t('שגיאה בטעינת קטע השמע')}</p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={status === 'loading'}
            aria-label={status === 'loading' ? t('טוען...') : isPlaying ? t('השהה') : t('נגן')}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center"
          >
            {/* A spinner rather than a faded/disabled circle — the earlier
                disabled:opacity-50 look was easy to mistake for the button
                not having rendered yet at all, especially right when a new
                question card appears. */}
            {status === 'loading' ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : isPlaying ? (
              '⏸'
            ) : (
              '▶'
            )}
          </button>
          {/* Media scrubbers read left-to-right even in RTL UI (same
              convention as voice-note players in Hebrew apps). The isolation
              style is applied directly to this flex-1 row rather than via
              LtrIsolate's wrapping <span> — that span has no flex sizing of
              its own, which left the progress bar collapsed to width: 0
              inside it. */}
          <div className="flex-1 flex items-center gap-2" style={LTR_ISOLATE_STYLE}>
            <span className="text-xs text-fg/60 tabular-nums">{formatTime(currentTime)}</span>
            <div
              ref={barRef}
              onClick={e => seekToClientX(e.clientX)}
              role="slider"
              aria-label={t('התקדמות ההשמעה')}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              className="relative flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 cursor-pointer"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary-600"
                style={{ width: `${duration && Number.isFinite(duration) ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-fg/60 tabular-nums">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-1.5" style={LTR_ISOLATE_STYLE}>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? t('בטל השתקה') : t('השתק')}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-fg/60 hover:text-fg"
            >
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={e => changeVolume(Number(e.target.value))}
              aria-label={t('עוצמת קול')}
              className="w-16 accent-primary-600"
            />
          </div>
          <audio
            ref={audioRef}
            src={`/api/naale/audio/${clipNumber}`}
            preload="metadata"
            muted={isMuted}
            onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            // The audio route's response has no Content-Length (see that
            // route's comment), which makes Chrome report `duration:
            // Infinity` until the whole clip has buffered — it self-corrects
            // by firing durationchange once the real value is known, but
            // onLoadedMetadata alone never sees that correction.
            onDurationChange={e => setDuration(e.currentTarget.duration)}
            onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
            onCanPlay={() => setStatus('ready')}
            onError={() => setStatus('error')}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false)
              if (audioRef.current) audioRef.current.currentTime = 0
              setCurrentTime(0)
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}
