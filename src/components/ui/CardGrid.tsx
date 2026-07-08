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
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 @[480px]:grid-cols-2 @[720px]:grid-cols-3 auto-rows-fr gap-3">{children}</div>
    </div>
  )
}
