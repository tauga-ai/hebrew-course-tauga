import type { ReactNode } from 'react'

/**
 * Real CSS grid with auto-rows-fr, so every Card stretches to the same
 * height as its tallest sibling regardless of subtitle length — replaces
 * the current ad-hoc mix of grid-cols-2, single-column gap-3 lists, and
 * stacked full-width buttons across the student pages.
 *
 * Columns key off this grid's own rendered width (container queries), not
 * the viewport — pages wrap it in very different max-w containers (from
 * max-w-md to max-w-5xl), and a viewport-based sm:/lg: breakpoint would
 * force 3 columns into a narrow container on any wide screen, squashing
 * card text down to a couple of characters.
 */
export function CardGrid({ children, cols = 3 }: { children: ReactNode; cols?: 3 | 4 }) {
  return (
    <div className="@container">
      <div
        className={`grid grid-cols-1 @[480px]:grid-cols-2 @[720px]:grid-cols-3 auto-rows-fr gap-3${
          // Opt-in only: every other student page is tuned for at most 3
          // columns, so widening the shared default would reflow them all.
          cols === 4 ? ' @[960px]:grid-cols-4' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}
