import { db } from './db'
import { keyOf, type Mode, type ProgressRow, type Question, type QType, type SubjectMeta } from '../domain/types'
import { isCorrect } from '../domain/grade'

const DATA_BASE = import.meta.env.BASE_URL || '/'

export async function fetchSubjectIndex(): Promise<{ subjects: SubjectMeta[]; total: number }> {
  const res = await fetch(`${DATA_BASE}data/subjects.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`题库索引加载失败 HTTP ${res.status}`)
  return res.json()
}

/** 把某个科目的题目导入 IndexedDB；已导入且数量一致则跳过 */
export async function ensureSubjectLoaded(
  meta: SubjectMeta,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const stored = await db.subjects.get(meta.id)
  const storedCount = await db.questions.where('subjectId').equals(meta.id).count()
  if (stored && storedCount === meta.count) return storedCount

  const res = await fetch(`${DATA_BASE}data/${meta.id}.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`题库加载失败 HTTP ${res.status}`)
  const payload: { schema: string; subject: SubjectMeta; questions: Question[] } = await res.json()
  if (payload.schema !== 'njfu-quiz/v1') throw new Error(`题库格式不支持: ${payload.schema}`)

  const rows: Question[] = payload.questions.map((q) => ({ ...q, subjectId: meta.id }))
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.questions.bulkPut(rows.slice(i, i + CHUNK))
    onProgress?.(Math.min(i + CHUNK, rows.length), rows.length)
  }
  await db.subjects.put({ ...payload.subject, ...meta, count: rows.length })
  return rows.length
}

export async function getQuestions(subjectId: string): Promise<Question[]> {
  return db.questions.where('subjectId').equals(subjectId).toArray()
}

export async function getQuestionMap(subjectId: string): Promise<Map<string, Question>> {
  const list = await getQuestions(subjectId)
  return new Map(list.map((q) => [q.qid, q]))
}

export async function getProgressMap(subjectId: string): Promise<Map<string, ProgressRow>> {
  const rows = await db.progress.where('subjectId').equals(subjectId).toArray()
  return new Map(rows.map((r) => [r.qid, r]))
}

export interface RecordArgs {
  subjectId: string
  qid: string
  question: Question
  userAnswer: string[]
  sessionId?: number
  at?: number
}

export interface RecordResult {
  correct: boolean
  /** 该题在错题本里的当前连对次数（不在错题本时为 0） */
  streak: number
  /** 是否因为本次答对而移出错题本 */
  mastered: boolean
}

/**
 * 记录一次作答：progress + attempts + 错题本，三张表一次事务。
 * 错题需连续答对 mastery 次才移出错题本，答错一次清零重来。
 */
export async function recordAnswer(args: RecordArgs & { mastery?: number }): Promise<RecordResult> {
  const { subjectId, qid, question, userAnswer, sessionId, at = Date.now() } = args
  const mastery = Math.max(1, args.mastery ?? 2)
  const correct = isCorrect(question, userAnswer)
  const key = keyOf(subjectId, qid)
  let streak = 0
  let mastered = false

  await db.transaction('rw', db.progress, db.attempts, db.wrongs, async () => {
    const prev = await db.progress.get(key)
    await db.progress.put({
      key, subjectId, qid,
      state: correct ? 'correct' : 'wrong',
      userAnswer,
      times: (prev?.times ?? 0) + 1,
      lastAt: at,
    })
    if (sessionId != null) {
      await db.attempts.add({ sessionId, subjectId, qid, correct, userAnswer, at })
    }
    const wrong = await db.wrongs.get(key)
    if (correct) {
      if (wrong && !wrong.cleared) {
        streak = (wrong.streak ?? 0) + 1
        if (streak >= mastery) {
          await db.wrongs.delete(key)
          streak = mastery
          mastered = true
        } else {
          await db.wrongs.update(key, { streak })
        }
      }
    } else {
      streak = 0
      await db.wrongs.put({
        key, subjectId, qid,
        count: (wrong?.count ?? 0) + 1,
        streak: 0,
        lastAt: at,
        cleared: false,
      })
    }
  })
  return { correct, streak, mastered }
}

export async function startSession(subjectId: string, mode: Mode, total: number): Promise<number> {
  return db.sessions.add({
    subjectId, mode, startedAt: Date.now(), endedAt: null,
    total, answered: 0, correct: 0, score: null,
  }) as Promise<number>
}

export async function finishSession(sessionId: number, patch: { answered: number; correct: number; score: number | null }) {
  await db.sessions.update(sessionId, { ...patch, endedAt: Date.now() })
}

export interface SubjectStats {
  total: number
  answered: number
  correct: number
  wrong: number
  accuracy: number
  byType: Record<QType, { total: number; answered: number; correct: number }>
}

export async function subjectStats(subjectId: string): Promise<SubjectStats> {
  const [questions, progress] = await Promise.all([
    db.questions.where('subjectId').equals(subjectId).toArray(),
    db.progress.where('subjectId').equals(subjectId).toArray(),
  ])
  const pm = new Map(progress.map((p) => [p.qid, p]))
  const byType: SubjectStats['byType'] = {
    single: { total: 0, answered: 0, correct: 0 },
    multiple: { total: 0, answered: 0, correct: 0 },
    judge: { total: 0, answered: 0, correct: 0 },
  }
  let answered = 0
  let correct = 0
  for (const q of questions) {
    const t = byType[q.type]
    t.total += 1
    const p = pm.get(q.qid)
    if (p && p.state !== 'unanswered') {
      answered += 1
      t.answered += 1
      if (p.state === 'correct') {
        correct += 1
        t.correct += 1
      }
    }
  }
  return {
    total: questions.length,
    answered, correct, wrong: answered - correct,
    accuracy: answered ? correct / answered : 0,
    byType,
  }
}

export async function listWrong(subjectId: string): Promise<{ qid: string; count: number; streak: number; lastAt: number }[]> {
  const rows = await db.wrongs.where('subjectId').equals(subjectId).toArray()
  return rows.filter((r) => !r.cleared)
    .map((r) => ({ qid: r.qid, count: r.count, streak: r.streak ?? 0, lastAt: r.lastAt }))
}

export async function wrongCountAll(): Promise<number> {
  const rows = await db.wrongs.toArray()
  return rows.filter((r) => !r.cleared).length
}

export async function removeWrong(subjectId: string, qid: string) {
  await db.wrongs.delete(keyOf(subjectId, qid))
}

export async function toggleStar(subjectId: string, qid: string): Promise<boolean> {
  const key = keyOf(subjectId, qid)
  const has = await db.stars.get(key)
  if (has) {
    await db.stars.delete(key)
    return false
  }
  await db.stars.put({ key, subjectId, qid, at: Date.now() })
  return true
}

export async function starSet(subjectId: string): Promise<Set<string>> {
  const rows = await db.stars.where('subjectId').equals(subjectId).toArray()
  return new Set(rows.map((r) => r.qid))
}

export async function resetSubject(subjectId: string) {
  await db.transaction('rw', db.progress, db.wrongs, db.stars, db.attempts, db.sessions, async () => {
    await db.progress.where('subjectId').equals(subjectId).delete()
    await db.wrongs.where('subjectId').equals(subjectId).delete()
    await db.stars.where('subjectId').equals(subjectId).delete()
    await db.attempts.where('subjectId').equals(subjectId).delete()
    await db.sessions.where('subjectId').equals(subjectId).delete()
  })
}

export async function recentSessions(limit = 20) {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray()
}

export async function getMastery(): Promise<number> {
  const v = await getMeta<number>('mastery', 2)
  return Math.max(1, Math.min(5, Number(v) || 2))
}

export async function setMastery(n: number) {
  await setMeta('mastery', Math.max(1, Math.min(5, n)))
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

export async function exportAll() {
  const [subjects, progress, wrongs, stars, sessions, attempts] = await Promise.all([
    db.subjects.toArray(), db.progress.toArray(), db.wrongs.toArray(),
    db.stars.toArray(), db.sessions.toArray(), db.attempts.toArray(),
  ])
  return { schema: 'njfu-quiz-backup/v1', at: new Date().toISOString(), subjects, progress, wrongs, stars, sessions, attempts }
}

export async function importAll(data: { progress?: any[]; wrongs?: any[]; stars?: any[]; sessions?: any[]; attempts?: any[] }) {
  await db.transaction('rw', db.progress, db.wrongs, db.stars, db.sessions, db.attempts, async () => {
    if (data.progress) await db.progress.bulkPut(data.progress)
    if (data.wrongs) await db.wrongs.bulkPut(data.wrongs)
    if (data.stars) await db.stars.bulkPut(data.stars)
    if (data.attempts) await db.attempts.bulkPut(data.attempts)
    if (data.sessions) {
      for (const s of data.sessions) {
        const { id, ...rest } = s
        await db.sessions.put({ ...rest, ...(id ? { id } : {}) } as any)
      }
    }
  })
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}
