import { describe, expect, it } from 'vitest'
import { answerText, isCorrect, normalizeAnswer, stemKey } from '../src/domain/grade'
import type { Question } from '../src/domain/types'

const q = (type: Question['type'], answer: string[], options: string[] = ['A', 'B', 'C', 'D']): Question => ({
  qid: 'x:1', serverId: 1, type, stem: '题干', answer,
  options: options.map((k, i) => ({ key: k, text: `选项${i + 1}` })),
  version: '20260701', hash: 'h', variantOf: null, subjectId: 'x',
})

describe('normalizeAnswer', () => {
  it('去重、排序、大写', () => {
    expect(normalizeAnswer(['b', 'A', 'a'])).toEqual(['A', 'B'])
    expect(normalizeAnswer('dcab')).toEqual(['A', 'B', 'C', 'D'])
    expect(normalizeAnswer(null)).toEqual([])
    expect(normalizeAnswer([])).toEqual([])
  })
  it('忽略非字母字符', () => {
    expect(normalizeAnswer('A,B.')).toEqual(['A', 'B'])
  })
})

describe('isCorrect 单选', () => {
  const single = q('single', ['D'])
  it('完全一致为对', () => expect(isCorrect(single, ['D'])).toBe(true))
  it('不同为错', () => expect(isCorrect(single, ['A'])).toBe(false))
  it('多选一个为错', () => expect(isCorrect(single, ['D', 'A'])).toBe(false))
  it('空答为错', () => expect(isCorrect(single, [])).toBe(false))
})

describe('isCorrect 多选', () => {
  const multi = q('multiple', ['A', 'C', 'D'])
  it('顺序无关', () => expect(isCorrect(multi, ['D', 'A', 'C'])).toBe(true))
  it('少选为错', () => expect(isCorrect(multi, ['A', 'C'])).toBe(false))
  it('多选为错', () => expect(isCorrect(multi, ['A', 'B', 'C', 'D'])).toBe(false))
  it('重复字母不影响', () => expect(isCorrect(multi, ['A', 'A', 'C', 'D'])).toBe(true))
  it('空答为错', () => expect(isCorrect(multi, [])).toBe(false))
})

describe('isCorrect 判断', () => {
  const judge = q('judge', ['A'], ['A', 'B'])
  it('A 正确', () => expect(isCorrect(judge, ['A'])).toBe(true))
  it('B 错误', () => expect(isCorrect(judge, ['B'])).toBe(false))
})

describe('answerText', () => {
  it('单选带选项文字', () => {
    expect(answerText(q('single', ['B']))).toBe('B. 选项2')
  })
  it('多选用斜杠连接', () => {
    expect(answerText(q('multiple', ['A', 'C']))).toBe('A. 选项1 / C. 选项3')
  })
  it('判断题输出正确/错误', () => {
    expect(answerText(q('judge', ['A'], ['A', 'B']))).toBe('正确')
    expect(answerText(q('judge', ['B'], ['A', 'B']))).toBe('错误')
  })
})

describe('stemKey', () => {
  it('去掉序号前缀与多余空白', () => {
    expect(stemKey('1. 第二次世界大战后,发达')).toBe('第二次世界大战后,发达')
    expect(stemKey('  2、某题  题干 ')).toBe('某题 题干')
    expect(stemKey('无前缀')).toBe('无前缀')
  })
})
