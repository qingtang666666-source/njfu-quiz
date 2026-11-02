import type { Question } from './types'

/** 答案统一成「大写字母、去重、排序」后的数组 */
export function normalizeAnswer(input: readonly string[] | string | null | undefined): string[] {
  if (input == null) return []
  const raw = Array.isArray(input) ? input : Array.from(input)
  const set = new Set<string>()
  for (const item of raw) {
    for (const ch of String(item)) {
      const up = ch.toUpperCase()
      if (up >= 'A' && up <= 'Z') set.add(up)
    }
  }
  return [...set].sort()
}

/** 判分：单选/判断完全相等，多选集合相等（少选多选都算错） */
export function isCorrect(q: Pick<Question, 'answer'>, userAnswer: readonly string[]): boolean {
  const a = normalizeAnswer(q.answer)
  const b = normalizeAnswer(userAnswer)
  if (a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}

/** 答案的可读文本，如 "D. 以阶级斗争为纲"；多选题用 " / " 连接 */
export function answerText(q: Question): string {
  const keys = normalizeAnswer(q.answer)
  const map = new Map(q.options.map((o) => [o.key, o.text]))
  const parts = keys.map((k) => {
    const t = map.get(k)
    return t ? `${k}. ${t}` : k
  })
  if (q.type === 'judge') {
    const only = keys[0]
    if (only === 'A') return '正确'
    if (only === 'B') return '错误'
  }
  return parts.join(' / ')
}

/** 选项展示文本，判断题去掉 "A." 前缀的重复感 */
export function optionText(q: Question, key: string): string {
  const hit = q.options.find((o) => o.key === key)
  return hit ? hit.text : ''
}

/** 题干去掉序号前缀，用于去重比较 */
export function stemKey(stem: string): string {
  return stem.replace(/^\s*\d+[.、．]\s*/, '').replace(/\s+/g, ' ').trim()
}
