import type { ReactNode } from 'react'

/**
 * Real CSS grid with auto-rows-fr, so every Card stretches to the same
 * height as its tallest sibling regardless of subtitle length — replaces
 * the current ad-hoc mix of grid-cols-2, single-column gap-3 lists, and
 * stacked full-width buttons across the student pages.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-3">{children}</div>
}
