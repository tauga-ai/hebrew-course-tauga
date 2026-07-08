import type { CSSProperties } from 'react'

/**
 * Applied to any LTR-flowing content — KaTeX formulas, or standalone
 * numbers/fractions/percentages like "45/75" or "80%" — embedded inside RTL
 * Hebrew/Arabic prose. `isolate` stops this content's bidi resolution from
 * being affected by (or affecting) the surrounding text; `direction: ltr`
 * locks the *base* direction explicitly rather than leaving it to
 * auto-detection — without this, a formula containing an embedded Hebrew
 * word (e.g. \text{ממוצעת} inside v_{\text{ממוצעת}}) could have its base
 * direction auto-detected as RTL from that embedded word, flipping the
 * whole formula's structural (numerator/denominator, equation) order.
 * Content that's genuinely RTL *within* the isolated island (like that same
 * embedded Hebrew word) still renders correctly right-to-left in its own
 * pocket — isolate does not force every character to display LTR, only the
 * base/paragraph direction. Standard W3C technique for embedding
 * foreign-direction content in bidi text (e.g. how Hebrew/Arabic Wikipedia
 * embeds LTR code/URLs/formulas inline).
 */
export const LTR_ISOLATE_STYLE: CSSProperties = {
  unicodeBidi: 'isolate',
  direction: 'ltr',
}
