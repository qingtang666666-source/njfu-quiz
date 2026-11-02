export type QType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay'

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
  /** 填空题的空数 */
  blanks?: number
  /** 简答/论述题的答案要点 */
  explanation?: string
  /** 章节（军理题库按章分） */
  chapter?: string
  /** 题库标注为过时（如旧军种名称），刷题时提示 */
  stale?: boolean
  staleNote?: string
  /** 数字类题，答案可能逐年变化 */
  verifyYear?: boolean
  /** 来自服务端官方答案 */
  official?: boolean
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

export type AnswerState = 'unanswered' | 'correct' | 'wrong' | 'viewed'

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
  count: number        // 累计答错次数
  streak: number       // 当前连续答对次数，答错清零
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
  fill: '填空',
  essay: '简答',
}

export const SCORE: Record<QType, number> = {
  single: 1,
  multiple: 2,
  judge: 1,
  fill: 1,
  essay: 0,
}

export function keyOf(subjectId: string, qid: string) {
  return `${subjectId}|${qid}`
}
