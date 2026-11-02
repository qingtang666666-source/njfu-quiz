import { SCORE, type QType, type Question } from './types'
import { stemKey } from './grade'

export interface ExamSpec {
  single: number
  multiple: number
  judge: number
  minutes: number
}

export const DEFAULT_EXAM: ExamSpec = { single: 60, multiple: 10, judge: 10, minutes: 60 }

export interface ExamPaper {
  questions: Question[]
  spec: ExamSpec
  fullScore: number
  minutes: number
}

function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 同题干只取一条（variantOf 为 null 的那条优先），避免同一题重复出现 */
export function uniqueByStem(questions: readonly Question[]): Question[] {
  const seen = new Set<string>()
  const out: Question[] = []
  for (const q of questions) {
    const k = `${q.type}|${stemKey(q.stem)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(q)
  }
  return out
}

/**
 * 组卷：按题型比例抽题。某题型不够时用现有数量，不越界。
 * 默认顺序：单选 → 多选 → 判断。
 */
export function buildExam(
  questions: readonly Question[],
  spec: ExamSpec = DEFAULT_EXAM,
  rand: () => number = Math.random,
): ExamPaper {
  const pool = uniqueByStem(questions)
  const byType = new Map<QType, Question[]>([
    ['single', []],
    ['multiple', []],
    ['judge', []],
  ])
  for (const q of pool) byType.get(q.type)!.push(q)

  const pick = (t: QType, n: number) => shuffle(byType.get(t)!, rand).slice(0, Math.max(0, n))
  const chosen = [...pick('single', spec.single), ...pick('multiple', spec.multiple), ...pick('judge', spec.judge)]

  const fullScore = chosen.reduce((s, q) => s + SCORE[q.type], 0)
  return { questions: chosen, spec, fullScore, minutes: spec.minutes }
}

/** 按题型给出实际可用数量，用于前端展示"本题库只有 652 道单选" */
export function availableCounts(questions: readonly Question[]) {
  const pool = uniqueByStem(questions)
  const counts: Record<QType, number> = { single: 0, multiple: 0, judge: 0 }
  for (const q of pool) counts[q.type] += 1
  return counts
}
