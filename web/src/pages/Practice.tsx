import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TopBar, subjectById, useApp } from '../App'
import { useSubject } from '../components/useSubject'
import {
  finishSession, getMeta, listWrong, recordAnswer, setMeta, startSession, starSet, toggleStar,
} from '../db/repo'
import { answerText, isCorrect, normalizeAnswer } from '../domain/grade'
import { TYPE_LABEL, type Question } from '../domain/types'

export type PracticeMode = 'sequential' | 'random' | 'wrong' | 'star'

const MODE_TITLE: Record<PracticeMode, string> = {
  sequential: '顺序练习',
  random: '随机练习',
  wrong: '错题练习',
  star: '收藏练习',
}

function shuffle<T>(a: readonly T[]): T[] {
  const x = a.slice()
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

export default function Practice({ sid, mode, startQid }: { sid: string; mode: PracticeMode; startQid?: string }) {
  const { subjects, back, toast } = useApp()
  const meta = subjectById(subjects, sid)
  const { questions, progress, loading } = useSubject(meta, sid)

  const [queue, setQueue] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [graded, setGraded] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [stars, setStars] = useState<Set<string>>(new Set())
  const [localState, setLocalState] = useState<Record<string, 'correct' | 'wrong'>>({})

  const sessionRef = useRef<number | null>(null)
  const countsRef = useRef({ answered: 0, correct: 0 })
  const builtRef = useRef(false)

  // 组队列
  useEffect(() => {
    if (loading || builtRef.current || !questions.length) return
    builtRef.current = true
    let alive = true
    ;(async () => {
      let list: Question[] = []
      if (mode === 'sequential') {
        list = questions.slice().sort((a, b) => a.serverId - b.serverId)
      } else if (mode === 'random') {
        list = shuffle(questions)
      } else if (mode === 'wrong') {
        const wrong = await listWrong(sid)
        const rank = new Map(wrong.map((w) => [w.qid, w.count]))
        list = questions.filter((q) => rank.has(q.qid)).sort((a, b) => (rank.get(b.qid)! - rank.get(a.qid)!))
      } else if (mode === 'star') {
        const set = await starSet(sid)
        list = questions.filter((q) => set.has(q.qid))
      }
      if (!alive) return
      setQueue(list)
      setStars(await starSet(sid))

      let start = 0
      if (startQid) {
        const i = list.findIndex((q) => q.qid === startQid)
        if (i >= 0) start = i
      } else if (mode === 'sequential') {
        const saved = await getMeta<string | null>(`pos:${sid}:sequential`, null)
        if (saved) {
          const i = list.findIndex((q) => q.qid === saved)
          if (i >= 0) start = i
        }
      }
      setIdx(start)
      sessionRef.current = await startSession(sid, mode, list.length)
    })()
    return () => { alive = false }
  }, [loading, questions, mode, sid, startQid])

  // 退出时结算会话
  useEffect(() => {
    return () => {
      const s = sessionRef.current
      if (s != null) {
        void finishSession(s, { answered: countsRef.current.answered, correct: countsRef.current.correct, score: null })
      }
    }
  }, [])

  const q = queue[idx]

  const reset = useCallback(() => {
    setSelected([])
    setGraded(false)
    setCorrect(false)
  }, [])

  const goTo = useCallback((n: number) => {
    setIdx(n)
    reset()
  }, [reset])

  const submit = useCallback(async (answer: string[]) => {
    if (!q || graded) return
    const ok = isCorrect(q, answer)
    setCorrect(ok)
    setGraded(true)
    setLocalState((s) => ({ ...s, [q.qid]: ok ? 'correct' : 'wrong' }))
    countsRef.current.answered += 1
    if (ok) countsRef.current.correct += 1
    await recordAnswer({
      subjectId: sid, qid: q.qid, question: q, userAnswer: answer,
      sessionId: sessionRef.current ?? undefined,
    })
    if (mode === 'sequential') void setMeta(`pos:${sid}:sequential`, q.qid)
  }, [q, graded, sid, mode])

  const choose = useCallback((key: string) => {
    if (!q || graded) return
    if (q.type === 'multiple') {
      setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : normalizeAnswer([...prev, key])))
    } else {
      setSelected([key])
      void submit([key])
    }
  }, [q, graded, submit])

  const next = useCallback(() => {
    if (idx + 1 < queue.length) goTo(idx + 1)
    else toast('已经是最后一题')
  }, [idx, queue.length, goTo, toast])

  const prev = useCallback(() => {
    if (idx > 0) goTo(idx - 1)
  }, [idx, goTo])

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (!q) return
      const k = e.key.toUpperCase()
      if (/^[A-F]$/.test(k) && !graded) {
        if (q.options.some((o) => o.key === k)) choose(k)
      } else if (e.key === 'Enter') {
        if (!graded && q.type === 'multiple' && selected.length) void submit(selected)
        else if (graded) next()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, graded, selected, choose, submit, next, prev])

  const stateOf = (qid: string) => localState[qid] ?? progress.get(qid)?.state
  const answeredN = useMemo(() => {
    let n = 0
    for (const item of queue) {
      const s = stateOf(item.qid)
      if (s === 'correct' || s === 'wrong') n += 1
    }
    return n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, localState, progress])

  if (!meta) return <><TopBar title="练习" /><div className="page"><div className="empty">题库不存在</div></div></>
  if (loading || !queue.length) {
    return (
      <>
        <TopBar title={MODE_TITLE[mode]} sub={meta.name} />
        <div className="page">
          {loading ? <div className="loading">正在准备题目…</div> : (
            <div className="empty">
              {mode === 'wrong' ? '错题本是空的，先去做几道题吧。' : mode === 'star' ? '还没有收藏的题目。' : '这个题库没有题目。'}
              <div style={{ marginTop: 16 }}><button className="btn" onClick={back}>返回</button></div>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar
        title={MODE_TITLE[mode]}
        sub={`${idx + 1}/${queue.length}`}
        right={
          <div className="row" style={{ gap: 6 }}>
            <button
              className="iconbtn"
              onClick={async () => {
                if (!q) return
                const on = await toggleStar(sid, q.qid)
                setStars((s) => {
                  const n = new Set(s)
                  if (on) n.add(q.qid); else n.delete(q.qid)
                  return n
                })
                toast(on ? '已收藏' : '已取消收藏')
              }}
              title="收藏"
            >
              {stars.has(q.qid) ? '★' : '☆'}
            </button>
            <button className="iconbtn" onClick={() => setShowJump(true)}>答题卡</button>
          </div>
        }
      />

      <div className="page" style={{ paddingBottom: 96 }}>
        <div className="qhead">
          <span className="badge">{TYPE_LABEL[q.type]}</span>
          <span className="tiny muted">第 {idx + 1} 题 · 已答 {answeredN}/{queue.length}</span>
        </div>

        <div className="stem">{q.stem}</div>

        {q.options.map((o) => {
          const isSel = selected.includes(o.key)
          let cls = 'opt'
          if (graded) {
            if (q.answer.includes(o.key)) cls += ' ok'
            else if (isSel) cls += ' bad'
          } else if (isSel) cls += ' sel'
          return (
            <button key={o.key} className={cls} disabled={graded} onClick={() => choose(o.key)}>
              <span className="k">{o.key}</span>
              <span className="t">{o.text}</span>
            </button>
          )
        })}

        {!graded && q.type === 'multiple' && (
          <button
            className="btn primary block"
            style={{ marginTop: 6 }}
            disabled={!selected.length}
            onClick={() => void submit(selected)}
          >
            确认答案（多选，可选多个）
          </button>
        )}

        {graded && (
          <>
            <div className={`answerbox ${correct ? 'ok' : 'bad'}`}>
              <div className="label">{correct ? '回答正确' : '回答错误'}</div>
              <div className="val">
                正确答案：{answerText(q)}
                {!correct && selected.length > 0 && (
                  <div className="small" style={{ marginTop: 4 }}>
                    你的答案：{normalizeAnswer(selected).join(' ')}
                  </div>
                )}
              </div>
            </div>
            <div className="tiny muted" style={{ marginBottom: 8 }}>
              题目 ID {q.serverId} · 版本 {q.version}
              {q.variantOf ? ' · 同题干变体' : ''}
            </div>
          </>
        )}
      </div>

      <div className="navbar">
        <div className="inner">
          <button className="btn" onClick={prev} disabled={idx === 0}>上一题</button>
          {graded ? (
            <button className="btn primary" onClick={next}>下一题</button>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                if (q.type === 'multiple') { if (selected.length) void submit(selected) }
                else if (selected.length) void submit(selected)
                else toast('先选一个答案')
              }}
            >
              确认答案
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
            <div className="tiny muted" style={{ marginBottom: 10 }}>
              已答 {answeredN} / {queue.length}
            </div>
            <div className="jumpgrid">
              {queue.map((item, i) => {
                const s = stateOf(item.qid)
                return (
                  <button
                    key={item.qid}
                    className={`${s === 'correct' ? 'ok' : s === 'wrong' ? 'bad' : ''} ${i === idx ? 'cur' : ''}`}
                    onClick={() => { goTo(i); setShowJump(false) }}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
