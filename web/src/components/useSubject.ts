import { useCallback, useEffect, useState } from 'react'
import { ensureSubjectLoaded, getProgressMap, getQuestions, subjectStats, type SubjectStats } from '../db/repo'
import type { ProgressRow, Question, SubjectMeta } from '../domain/types'

export interface SubjectData {
  questions: Question[]
  progress: Map<string, ProgressRow>
  stats: SubjectStats | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSubject(meta: SubjectMeta | undefined, sid: string): SubjectData {
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Map<string, ProgressRow>>(new Map())
  const [stats, setStats] = useState<SubjectStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    if (!meta) {
      setLoading(false)
      setError('题库不存在')
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        await ensureSubjectLoaded(meta)
        const [qs, pg, st] = await Promise.all([
          getQuestions(sid),
          getProgressMap(sid),
          subjectStats(sid),
        ])
        if (!alive) return
        setQuestions(qs)
        setProgress(pg)
        setStats(st)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [meta, sid, tick])

  return { questions, progress, stats, loading, error, reload }
}
