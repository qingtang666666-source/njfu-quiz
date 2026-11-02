import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TopBar, subjectById, useApp } from '../App'
import { useSubject } from '../components/useSubject'
import { finishSession, recordAnswer, startSession } from '../db/repo'
import { isCorrect, normalizeAnswer } from '../domain/grade'
import { DEFAULT_EXAM, availableCounts, buildExam, type ExamPaper } from '../domain/exam'
import { SCORE, TYPE_LABEL } from '../domain/types'
import type { ExamResult } from './Result'

function fmt(sec: number) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function Exam({ sid }: { sid: string }) {
  const { subjects, go, back, toast } = useApp()
  const meta = subjectById(subjects, sid)
  const { questions, loading } = useSubject(meta, sid)

  const [phase, setPhase] = useState<'setup' | 'running'>('setup')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [idx, setIdx] = useState(0)
  const [endsAt, setEndsAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [showJump, setShowJump] = useState(false)
  const sessionRef = useRef<number | null>(null)
  const submittedRef = useRef(false)
  const startedAtRef = useRef(0)

  const counts = useMemo(() => availableCounts(questions), [questions])

  useEffect(() => {
    if (phase !== 'running') return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [phase])

  const submitExam = useCallback(async () => {
    if (!paper || submittedRef.current) return
    submittedRef.current = true
    const endedAt = Date.now()
    let correctCount = 0
    let score = 0
    for (const q of paper.questions) {
      const ua = answers[q.qid] ?? []
      const ok = isCorrect(q, ua)
      if (ok) { correctCount += 1; score += SCORE[q.type] }
      await recordAnswer({ subjectId: sid, qid: q.qid, question: q, userAnswer: ua, sessionId: sessionRef.current ?? undefined })
    }
    const answered = paper.questions.filter((q) => (answers[q.qid]?.length ?? 0) > 0).length
    if (sessionRef.current != null) {
      await finishSession(sessionRef.current, { answered, correct: correctCount, score })
    }
    const result: ExamResult = {
      paper, answers, startedAt: startedAtRef.current, endedAt,
      correctCount, score, answered,
    }
    go({ name: 'result', sid, result })
  }, [paper, answers, sid, go])

  // 时间到自动交卷
  useEffect(() => {
    if (phase !== 'running' || !endsAt) return
    if (now >= endsAt && !submittedRef.current) {
      toast('时间到，已自动交卷')
      void submitExam()
    }
  }, [now, endsAt, phase, submitExam, toast])

  const start = useCallback(async () => {
    const p = buildExam(questions, DEFAULT_EXAM)
    setPaper(p)
    setAnswers({})
    setIdx(0)
    startedAtRef.current = Date.now()
    setEndsAt(Date.now() + p.minutes * 60_000)
    setNow(Date.now())
    submittedRef.current = false
    sessionRef.current = await startSession(sid, 'exam', p.questions.length)
    setPhase('running')
  }, [questions, sid])

  if (!meta) return <><TopBar title="模拟考试" /><div className="page"><div className="empty">题库不存在</div></div></>

  if (loading) {
    return <><TopBar title="模拟考试" sub={meta.name} /><div className="page"><div className="loading">正在准备题目…</div></div></>
  }

  if (phase === 'setup') {
    const spec = DEFAULT_EXAM
    const short = (['single', 'multiple', 'judge'] as const).filter((t) => counts[t] < spec[t])
    return (
      <>
        <TopBar title="模拟考试" sub={meta.name} />
        <div className="page">
          <div className="card">
            <h2>组卷规则</h2>
            <div className="row between small" style={{ marginBottom: 6 }}>
              <span>单选 {Math.min(spec.single, counts.single)} 题 × 1 分</span>
              <span className="muted">题库 {counts.single} 题</span>
            </div>
            <div className="row between small" style={{ marginBottom: 6 }}>
              <span>多选 {Math.min(spec.multiple, counts.multiple)} 题 × 2 分</span>
              <span className="muted">题库 {counts.multiple} 题</span>
            </div>
            <div className="row between small" style={{ marginBottom: 6 }}>
              <span>判断 {Math.min(spec.judge, counts.judge)} 题 × 1 分</span>
              <span className="muted">题库 {counts.judge} 题</span>
            </div>
            <div className="row between small" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <span>限时 {spec.minutes} 分钟</span>
              <span className="muted">
                满分{' '}
                {Math.min(spec.single, counts.single) * 1 +
                  Math.min(spec.multiple, counts.multiple) * 2 +
                  Math.min(spec.judge, counts.judge) * 1} 分
              </span>
            </div>
            {short.length > 0 && (
              <div className="tiny" style={{ marginTop: 10, color: 'var(--warn)' }}>
                该题库题量不足，{short.map((t) => TYPE_LABEL[t]).join('、')}按实际题量出卷。
              </div>
            )}
            <div className="tiny muted" style={{ marginTop: 10 }}>
              同题干只出一题；交卷后按题计分，多选题少选或多选均不得分。
            </div>
          </div>
          <button className="btn primary block" onClick={() => void start()}>开始考试</button>
          <div style={{ height: 10 }} />
          <button className="btn block ghost" onClick={back}>返回</button>
        </div>
      </>
    )
  }

  if (!paper || !paper.questions.length) {
    return <><TopBar title="模拟考试" /><div className="page"><div className="empty">没有可用的题目</div></div></>
  }

  const q = paper.questions[idx]
  const sel = answers[q.qid] ?? []
  const left = Math.floor((endsAt - now) / 1000)
  const answeredN = paper.questions.filter((x) => (answers[x.qid]?.length ?? 0) > 0).length

  const pick = (key: string) => {
    setAnswers((prev) => {
      const cur = prev[q.qid] ?? []
      if (q.type === 'multiple') {
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : normalizeAnswer([...cur, key])
        return { ...prev, [q.qid]: next }
      }
      return { ...prev, [q.qid]: [key] }
    })
  }

  return (
    <>
      <TopBar
        title="模拟考试"
        sub={`${idx + 1}/${paper.questions.length} · 已答 ${answeredN}`}
        right={
          <div className="row" style={{ gap: 6 }}>
            <span className={`timer ${left < 60 ? 'danger' : left < 300 ? 'warn' : ''}`}>{fmt(left)}</span>
            <button className="iconbtn" onClick={() => setShowJump(true)}>答题卡</button>
          </div>
        }
      />

      <div className="page" style={{ paddingBottom: 110 }}>
        <div className="qhead">
          <span className="badge">{TYPE_LABEL[q.type]}</span>
          <span className="tiny muted">{SCORE[q.type]} 分</span>
        </div>
        <div className="stem">{q.stem}</div>
        {q.stale && (
          <div className="tiny" style={{ color: '#c0392b', marginBottom: 8 }}>
            ⚠ 本题涉及的表述已过时：{q.staleNote}
          </div>
        )}
        {q.options.map((o) => (
          <button key={o.key} className={`opt ${sel.includes(o.key) ? 'sel' : ''}`} onClick={() => pick(o.key)}>
            <span className="k">{o.key}</span>
            <span className="t">{o.text}</span>
          </button>
        ))}
      </div>

      <div className="navbar">
        <div className="inner">
          <button className="btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>上一题</button>
          {idx + 1 < paper.questions.length ? (
            <button className="btn primary" onClick={() => setIdx((i) => i + 1)}>下一题</button>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                const un = paper.questions.length - answeredN
                if (un > 0 && !confirm(`还有 ${un} 题未作答，确认交卷？`)) return
                void submitExam()
              }}
            >
              交卷
            </button>
          )}
        </div>
      </div>

      {showJump && (
        <div className="sheet" onClick={() => setShowJump(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>答题卡</h3>
              <button className="btn sm ghost" onClick={() => setShowJump(false)}>关闭</button>
            </div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>已答 {answeredN} / {paper.questions.length}</div>
            <div className="jumpgrid">
              {paper.questions.map((item, i) => (
                <button
                  key={item.qid}
                  className={`${(answers[item.qid]?.length ?? 0) > 0 ? 'ok' : ''} ${i === idx ? 'cur' : ''}`}
                  onClick={() => { setIdx(i); setShowJump(false) }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              className="btn primary block"
              style={{ marginTop: 12 }}
              onClick={() => {
                const un = paper.questions.length - answeredN
                if (un > 0 && !confirm(`还有 ${un} 题未作答，确认交卷？`)) return
                void submitExam()
              }}
            >
              交卷
            </button>
          </div>
        </div>
      )}
    </>
  )
}
