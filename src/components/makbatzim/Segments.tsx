import type { Segment } from '@/data/makbatzim/types'
import { KatexFormula } from '@/components/tzav-rishon/KatexFormula'

/** Renders a question/option/explanation's Segment[] as interleaved plain text and KaTeX formulas. */
export function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'math' ? <KatexFormula key={i} tex={seg.content} /> : <span key={i}>{seg.content}</span>
      )}
    </>
  )
}
