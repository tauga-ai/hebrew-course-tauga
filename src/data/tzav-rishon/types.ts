export type Segment = { type: 'text' | 'math'; content: string }

export interface QuestionOption {
  he: Segment[]
  ar: Segment[]
}

export interface TzavRishonQuestion {
  id: number
  question: { he: Segment[]; ar: Segment[] }
  options: QuestionOption[]
  correctOption: number
  explanation: { he: Segment[]; ar: Segment[] }
}

export type TopicKey = 'percentages' | 'averages' | 'motion' | 'probability'

export interface TopicMeta {
  key: TopicKey
  labelHe: string
  labelAr: string
  count: number
}
