import type { Segment } from '@/lib/tzav-rishon-segments'

export type { Segment }

export interface MakbatzimQuestion {
  id: number
  question: Segment[]
  /** Present only when the source row's Image URL cell was non-empty — independent of the source Content Type column (which also has a `geometry` value that renders identically to `mcq`, i.e. no image). */
  imageUrl?: string
  options: Segment[][]
  correctOption: number
  explanation: Segment[]
}

export type SetKey = 'set-1' | 'set-2' | 'set-3' | 'set-4' | 'set-1-tzurani' | 'set-1-analogies' | 'set-1-instructions' | 'dapar-simulation'

export interface SetMeta {
  key: SetKey
  labelHe: string
  count: number
}
