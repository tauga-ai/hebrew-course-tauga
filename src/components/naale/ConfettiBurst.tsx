'use client'

import { useState, type CSSProperties } from 'react'

const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#ef4444']
const PIECE_COUNT = 24

interface ConfettiPiece {
  color: string
  delay: number
  dx: number
  dy: number
  width: number
  height: number
}

interface ConfettiCSSProperties extends CSSProperties {
  '--dx': string
  '--dy': string
}

// A plain, non-component helper — React's purity check (rightly) rejects
// Math.random() called directly in a component's render body, the same
// reason use-countdown.ts keeps its Date.now() read in a bare function
// outside useCountdown() itself. Called exactly once, from useState's lazy
// initializer below, never during a re-render.
function makePieces(): ConfettiPiece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const angle = (i / PIECE_COUNT) * 360 + Math.random() * 25
    // Wider spread and a stronger upward pop than the first pass — the
    // original (40-90px, tiny 8px squares) read as barely-there per direct
    // feedback ("weird, very small").
    const distance = 90 + Math.random() * 110
    const radians = (angle * Math.PI) / 180
    return {
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.15,
      dx: Math.cos(radians) * distance,
      dy: Math.sin(radians) * distance - 60,
      // Rectangular confetti-strip proportions, not uniform squares, and
      // noticeably bigger than the first pass (8px) — varies per piece for
      // a less mechanical look.
      width: 8 + Math.random() * 6,
      height: 12 + Math.random() * 10,
    }
  })
}

/**
 * Pure-CSS confetti burst — no animation library, matches this codebase's
 * "lightweight, no elaborate animation" bar (see session/page.tsx's reward-
 * flash comment) while still being an actual celebratory effect on a
 * correct Naale answer, per explicit request. Purely presentational (no
 * business logic, no route coupling), so it's shared between session/page.tsx
 * and placement/page.tsx rather than duplicated like their answer-flow logic
 * intentionally is.
 *
 * Mount-triggered, not prop-triggered: parents render this conditionally
 * (`{result?.is_correct && <ConfettiBurst />}`), and `result` resets to null
 * between questions before the next one loads — so this fully unmounts and
 * remounts fresh on every correct answer, restarting the CSS animation with
 * no key trick needed. The one-time randomization lives in useState's lazy
 * initializer, so it runs once per mount (once per burst), not on every
 * re-render of whatever's rendering this.
 */
export function ConfettiBurst() {
  const [pieces] = useState(makePieces)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible z-10" aria-hidden>
      {pieces.map((piece, i) => {
        const style: ConfettiCSSProperties = {
          backgroundColor: piece.color,
          width: `${piece.width}px`,
          height: `${piece.height}px`,
          animationDelay: `${piece.delay}s`,
          animation: 'confetti-burst 1s ease-out forwards',
          '--dx': `${piece.dx}px`,
          '--dy': `${piece.dy}px`,
        }
        return <span key={i} className="absolute left-1/2 top-0 rounded-sm" style={style} />
      })}
    </div>
  )
}
