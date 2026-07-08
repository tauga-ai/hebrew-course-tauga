import katex from 'katex'
import { LTR_ISOLATE_STYLE } from './bidi'

/**
 * Renders one LaTeX math segment via KaTeX. See bidi.ts for why both
 * unicode-bidi:isolate and direction:ltr are needed — every
 * question/option/explanation this renders inside is Hebrew or Arabic
 * prose. `throwOnError: false` renders KaTeX's own visible error indicator
 * instead of crashing the page if a segment is malformed.
 *
 * Named KatexFormula rather than "Math" to avoid shadowing the global
 * `Math` object (Math.round, Math.floor, ...) in any file that imports it.
 */
export function KatexFormula({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { throwOnError: false })
  return <span style={LTR_ISOLATE_STYLE} dangerouslySetInnerHTML={{ __html: html }} />
}
