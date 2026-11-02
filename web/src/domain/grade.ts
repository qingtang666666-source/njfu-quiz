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

/** 文本归一化：去空白与中英文标点，忽略大小写 */
export function normalizeText(input: string | null | undefined): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[，。、；：""''（）()【】《》？！,.;:?!"'`~\-—_]/g, '')
}

/** 单个空的判分：完全一致，或用户答案落在正确答案的括号别名里 */
export function matchBlank(correct: string, user: string): boolean {
  const c = normalizeText(correct)
  const u = normalizeText(user)
  if (!u) return false
  if (c === u) return true
  if (c.includes(u) && u.length >= Math.max(2, Math.floor(c.length * 0.45))) return true
  return false
}

/**
 * 判分：
 *   单选/判断 完全相等
 *   多选     集合相等（少选多选都算错）
 *   填空     逐空比对，全部对才算对
 *   简答     不判分，始终返回 false
 */
export function isCorrect(
  q: Pick<Question, 'answer'> & { type?: Question['type'] },
  userAnswer: readonly string[],
): boolean {
  if (q.type === 'essay') return false
  if (q.type === 'fill') {
    const answers = q.answer
    if (userAnswer.length !== answers.length) return false
    return answers.every((a, i) => matchBlank(a, userAnswer[i] ?? ''))
  }
  const a = normalizeAnswer(q.answer)
  const b = normalizeAnswer(userAnswer)
  if (a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}

/** 答案的可读文本，如 "D. 以阶级斗争为纲"；多选题用 " / " 连接 */
export function answerText(q: Question): string {
  if (q.type === 'fill') return q.answer.join(' / ')
  if (q.type === 'essay') return q.explanation ?? ''
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
