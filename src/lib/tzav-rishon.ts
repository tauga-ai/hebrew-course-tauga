import 'server-only'
import {
  TOPICS,
  getTopicMeta,
  getTopicQuestions,
  getQuestionById,
  getTotalQuestionCount,
} from '@/data/tzav-rishon'
import type { Segment, TopicKey, TopicMeta, TzavRishonQuestion } from '@/data/tzav-rishon/types'
import { gradeAnswer } from './tzav-rishon-grading'

export type { Segment, TopicKey, TopicMeta, TzavRishonQuestion }
export { TOPICS, getTopicMeta, getTopicQuestions, getQuestionById, getTotalQuestionCount, gradeAnswer }
