import 'server-only'
import type { SetKey, SetMeta, MakbatzimQuestion } from './types'
import set1Data from './set-1/data.json'
import set2Data from './set-2/data.json'
import set3Data from './set-3/data.json'
import set4Data from './set-4/data.json'
import set1TzuraniData from './set-1-tzurani/data.json'
import set1AnalogiesData from './set-1-analogies/data.json'
import set1InstructionsData from './set-1-instructions/data.json'
import daparSimulationData from './dapar-simulation/data.json'

const DATA: Record<SetKey, MakbatzimQuestion[]> = {
  'set-1': set1Data as MakbatzimQuestion[],
  'set-2': set2Data as MakbatzimQuestion[],
  'set-3': set3Data as MakbatzimQuestion[],
  'set-4': set4Data as MakbatzimQuestion[],
  'set-1-tzurani': set1TzuraniData as MakbatzimQuestion[],
  'set-1-analogies': set1AnalogiesData as MakbatzimQuestion[],
  'set-1-instructions': set1InstructionsData as MakbatzimQuestion[],
  'dapar-simulation': daparSimulationData as MakbatzimQuestion[],
}

const LABELS: Record<SetKey, string> = {
  'set-1': 'מקבץ 1',
  'set-2': 'מקבץ 2',
  'set-3': 'מקבץ 3',
  'set-4': 'מקבץ 4',
  'set-1-tzurani': 'מקבץ 1 - צורני',
  'set-1-analogies': 'מקבץ 1 - אנלוגיות מילוליות',
  'set-1-instructions': 'מקבץ 1 - הוראות',
  'dapar-simulation': 'סימולציה דפ״ר',
}

export const SETS: SetMeta[] = (Object.keys(DATA) as SetKey[]).map(key => ({
  key,
  labelHe: LABELS[key],
  count: DATA[key].length,
}))

export function getSetMeta(setId: string): SetMeta | null {
  return SETS.find(s => s.key === setId) ?? null
}

export function getSetQuestions(setId: string): MakbatzimQuestion[] | null {
  if (!(setId in DATA)) return null
  return DATA[setId as SetKey]
}

export function getQuestionById(setId: string, questionId: number): MakbatzimQuestion | null {
  const questions = getSetQuestions(setId)
  return questions?.find(q => q.id === questionId) ?? null
}
