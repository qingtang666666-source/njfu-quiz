import { describe, expect, it } from 'vitest'
import { availableCounts, buildExam, uniqueByStem, DEFAULT_EXAM } from '../src/domain/exam'
import type { Question } from '../src/domain/types'

function mk(n: number, type: Question['type'], stemPrefix = 's', startId = 1): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    qid: `x:${startId + i}`,
    serverId: startId + i,
    type,
    stem: `${stemPrefix}-${startId + i}`,
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
    answer: ['A'],
    version: 'v',
    hash: `h${startId + i}`,
    variantOf: null,
    subjectId: 'x',
  }))
}

describe('uniqueByStem', () => {
  it('同题干同题型只留一条', () => {
    const a = mk(1, 'single')
    const dup: Question = { ...a[0], qid: 'x:99', serverId: 99 }
    expect(uniqueByStem([...a, dup])).toHaveLength(1)
  })
  it('同题干不同题型都保留', () => {
    const a = mk(1, 'single')
    const b: Question = { ...a[0], type: 'judge', qid: 'x:2' }
    expect(uniqueByStem([...a, b])).toHaveLength(2)
  })
})

describe('availableCounts', () => {
  it('按题型统计去重后的数量', () => {
    const list = [...mk(5, 'single'), ...mk(3, 'multiple', 'm'), ...mk(2, 'judge', 'j')]
    expect(availableCounts(list)).toEqual({ single: 5, multiple: 3, judge: 2 })
  })
})

describe('buildExam', () => {
  it('按规格抽题并算满分', () => {
    const list = [...mk(100, 'single', 's', 1), ...mk(50, 'multiple', 'm', 1000), ...mk(50, 'judge', 'j', 2000)]
    const p = buildExam(list, { single: 60, multiple: 10, judge: 10, minutes: 60 }, () => 0.5)
    expect(p.questions).toHaveLength(80)
    expect(p.fullScore).toBe(60 * 1 + 10 * 2 + 10 * 1)
    expect(p.questions.filter((q) => q.type === 'single')).toHaveLength(60)
  })

  it('题量不足时不越界', () => {
    const list = [...mk(5, 'single', 's', 1), ...mk(2, 'multiple', 'm', 100), ...mk(1, 'judge', 'j', 200)]
    const p = buildExam(list, DEFAULT_EXAM, () => 0.5)
    expect(p.questions).toHaveLength(8)
    expect(p.fullScore).toBe(5 * 1 + 2 * 2 + 1 * 1)
  })

  it('没有多选的题库（人工智能）也能出卷', () => {
    const list = [...mk(70, 'single'), ...mk(40, 'judge', 'j', 1000)]
    const p = buildExam(list, DEFAULT_EXAM, () => 0.5)
    expect(p.questions.filter((q) => q.type === 'multiple')).toHaveLength(0)
    // 没有多选就只出 60 单选 + 10 判断
    expect(p.questions).toHaveLength(70)
  })

  it('卷内不重复', () => {
    const list = [...mk(100, 'single', 's', 1), ...mk(20, 'multiple', 'm', 1000), ...mk(20, 'judge', 'j', 2000)]
    const p = buildExam(list, DEFAULT_EXAM, Math.random)
    expect(new Set(p.questions.map((q) => q.qid)).size).toBe(p.questions.length)
  })

  it('随机源可注入，结果可复现', () => {
    const list = [...mk(100, 'single')]
    const a = buildExam(list, { single: 10, multiple: 0, judge: 0, minutes: 10 }, () => 0.42)
    const b = buildExam(list, { single: 10, multiple: 0, judge: 0, minutes: 10 }, () => 0.42)
    expect(a.questions.map((q) => q.qid)).toEqual(b.questions.map((q) => q.qid))
  })
})
