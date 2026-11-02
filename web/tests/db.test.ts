import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { recordAnswer, subjectStats } from '../src/db/repo'
import type { Question } from '../src/domain/types'

const Q = (id: number, type: Question['type'] = 'single', answer = ['A']): Question => ({
  qid: `t:${id}`, serverId: id, type, stem: `题${id}`,
  options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
  answer, version: 'v', hash: `h${id}`, variantOf: null, subjectId: 't',
})

const rec = (q: Question, userAnswer: string[], sessionId?: number) =>
  recordAnswer({ subjectId: 't', qid: q.qid, question: q, userAnswer, sessionId })

beforeEach(async () => {
  await Promise.all([
    db.questions.clear(), db.progress.clear(), db.wrongs.clear(),
    db.stars.clear(), db.attempts.clear(), db.sessions.clear(), db.subjects.clear(),
  ])
  await db.questions.bulkPut([Q(1), Q(2), Q(3, 'multiple', ['A', 'C'])])
})

describe('recordAnswer / 错题本', () => {
  it('答对写 correct，答错写 wrong 并入错题本', async () => {
    await rec(Q(1), ['A'])
    await rec(Q(2), ['B'])
    expect((await db.progress.get('t|t:1'))?.state).toBe('correct')
    expect((await db.progress.get('t|t:2'))?.state).toBe('wrong')
    expect((await db.wrongs.get('t|t:2'))?.count).toBe(1)
  })

  it('同一题再答错，错误次数累加', async () => {
    await rec(Q(2), ['B'])
    await rec(Q(2), ['C'])
    expect((await db.wrongs.get('t|t:2'))?.count).toBe(2)
    expect((await db.progress.get('t|t:2'))?.times).toBe(2)
  })

  it('连续答对 2 次才移出错题本，答错清零', async () => {
    await rec(Q(2), ['B'])
    expect((await db.wrongs.get('t|t:2'))?.streak).toBe(0)

    // 第一次答对：留在错题本，连对 1
    await rec(Q(2), ['A'])
    expect((await db.wrongs.get('t|t:2'))?.streak).toBe(1)

    // 答错：清零
    await rec(Q(2), ['C'])
    expect((await db.wrongs.get('t|t:2'))?.streak).toBe(0)

    // 连对两次：移出
    await rec(Q(2), ['A'])
    expect((await db.wrongs.get('t|t:2'))?.streak).toBe(1)
    await rec(Q(2), ['A'])
    expect(await db.wrongs.get('t|t:2')).toBeUndefined()
    expect((await db.progress.get('t|t:2'))?.state).toBe('correct')
  })

  it('mastery=1 时答对立即移出', async () => {
    await rec(Q(2), ['B'])
    await recordAnswer({ subjectId: 't', qid: 't:2', question: Q(2), userAnswer: ['A'], mastery: 1 })
    expect(await db.wrongs.get('t|t:2')).toBeUndefined()
  })

  it('多选按集合判分', async () => {
    const q3 = Q(3, 'multiple', ['A', 'C'])
    await rec(q3, ['C', 'A'])
    expect((await db.progress.get('t|t:3'))?.state).toBe('correct')
    await rec(q3, ['A'])
    expect((await db.progress.get('t|t:3'))?.state).toBe('wrong')
  })

  it('带 sessionId 时写 attempts', async () => {
    await rec(Q(1), ['A'], 7)
    const rows = await db.attempts.where('sessionId').equals(7).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].correct).toBe(true)
  })
})

describe('重复导入不产生重复题', () => {
  it('同 qid bulkPut 两次仍是一条', async () => {
    const before = await db.questions.count()
    await db.questions.bulkPut([Q(1), Q(2)])
    expect(await db.questions.count()).toBe(before)
  })
})

describe('subjectStats', () => {
  it('按题型统计已答与正确数', async () => {
    await rec(Q(1), ['A'])
    await rec(Q(2), ['B'])
    const st = await subjectStats('t')
    expect(st.total).toBe(3)
    expect(st.answered).toBe(2)
    expect(st.correct).toBe(1)
    expect(st.byType.single).toEqual({ total: 2, answered: 2, correct: 1 })
    expect(st.byType.multiple).toEqual({ total: 1, answered: 0, correct: 0 })
  })
})
