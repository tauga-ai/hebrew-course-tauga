import 'server-only'
import type { TopicKey, TopicMeta, TzavRishonQuestion } from './types'
import { withContentPatch } from '@/lib/tzav-rishon-content-patches'
import percentagesData from './percentages/data.json'
import averagesData from './averages/data.json'
import motionData from './motion/data.json'
import probabilityData from './probability/data.json'

const DATA: Record<TopicKey, TzavRishonQuestion[]> = {
  percentages: percentagesData as TzavRishonQuestion[],
  averages: averagesData as TzavRishonQuestion[],
  motion: motionData as TzavRishonQuestion[],
  probability: probabilityData as TzavRishonQuestion[],
}

const LABELS: Record<TopicKey, { he: string; ar: string }> = {
  percentages: { he: 'אחוזים', ar: 'النسب المئوية' },
  averages: { he: 'ממוצעים', ar: 'المعدلات' },
  motion: { he: 'תנועה', ar: 'الحركة' },
  probability: { he: 'הסתברות', ar: 'الاحتمالات' },
}

export const TOPICS: TopicMeta[] = (Object.keys(DATA) as TopicKey[]).map(key => ({
  key,
  labelHe: LABELS[key].he,
  labelAr: LABELS[key].ar,
  count: DATA[key].length,
}))

export function getTopicMeta(topic: string): TopicMeta | null {
  return TOPICS.find(t => t.key === topic) ?? null
}

export function getTopicQuestions(topic: string): TzavRishonQuestion[] | null {
  if (!(topic in DATA)) return null
  return DATA[topic as TopicKey].map(q => withContentPatch(topic, q))
}

export function getQuestionById(topic: string, questionId: number): TzavRishonQuestion | null {
  const questions = getTopicQuestions(topic)
  return questions?.find(q => q.id === questionId) ?? null
}

export function getTotalQuestionCount(): number {
  return TOPICS.reduce((sum, t) => sum + t.count, 0)
}
