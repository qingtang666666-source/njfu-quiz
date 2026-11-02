export type QType = 'single' | 'multiple' | 'judge'

export interface Option {
  key: string
  text: string
}

export interface Question {
  qid: string
  serverId: number
  type: QType
  stem: string
  options: Option[]
  answer: string[]
  version: string
  hash: string
  variantOf: string | null
  subjectId: string
}

export interface SubjectMeta {
  id: string
  name: string
  term: string
  version: string
  count: number
  byType: Partial<Record<QType, number>>
  variants: number
}

export type AnswerState = 'unanswered' | 'correct' | 'wrong'

export interface ProgressRow {
  key: string // `${subjectId}|${qid}`
  subjectId: string
  qid: string
  state: AnswerState
  userAnswer: string[]
  times: number
  lastAt: number
}

export interface WrongRow {
  key: string
  subjectId: string
  qid: string
  count: number
  lastAt: number
  cleared: boolean
}

export interface StarRow {
  key: string
  subjectId: string
  qid: string
  at: number
}

export type Mode = 'sequential' | 'random' | 'wrong' | 'star' | 'exam'

export interface SessionRow {
  id?: number
  subjectId: string
  mode: Mode
  startedAt: number
  endedAt: number | null
  total: number
  answered: number
  correct: number
  score: number | null
}

export interface AttemptRow {
  id?: number
  sessionId: number
  subjectId: string
  qid: string
  correct: boolean
  userAnswer: string[]
  at: number
}

export const TYPE_LABEL: Record<QType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
}

export const SCORE: Record<QType, number> = {
  single: 1,
  multiple: 2,
  judge: 1,
}

export function keyOf(subjectId: string, qid: string) {
  return `${subjectId}|${qid}`
}
