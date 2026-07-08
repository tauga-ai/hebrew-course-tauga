import type { ReactNode } from 'react'
import { LTR_ISOLATE_STYLE } from './bidi'

/**
 * Wraps standalone LTR content embedded in RTL Hebrew/Arabic prose that is
 * NOT going through KaTeX — question counters ("5 מתוך 75"), progress
 * fractions ("45/75"), percentages ("80%"). Same isolation technique as
 * KatexFormula (see bidi.ts), applied to plain text/numbers instead of
 * KaTeX-rendered HTML, so these never get reordered or visually scrambled
 * by the surrounding RTL flow.
 */
export function LtrIsolate({ children }: { children: ReactNode }) {
  return <span style={LTR_ISOLATE_STYLE}>{children}</span>
}
