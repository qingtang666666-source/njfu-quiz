import { TopBar, subjectById, useApp } from '../App'
import type { ExamPaper } from '../domain/exam'
import { answerText, isCorrect } from '../domain/grade'
import { SCORE, TYPE_LABEL, type QType } from '../domain/types'

export interface ExamResult {
  paper: ExamPaper
  answers: Record<string, string[]>
  startedAt: number
  endedAt: number
  correctCount: number
  score: number
  answered: number
}

export default function Result({ sid, result }: { sid: string; result: ExamResult }) {
  const { subjects, go, back } = useApp()
  const meta = subjectById(subjects, sid)
  const { paper, answers, correctCount, score, startedAt, endedAt, answered } = result
  const total = paper.questions.length
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000))
  const pct = paper.fullScore ? Math.round((score / paper.fullScore) * 1000) / 10 : 0

  const byType: Record<QType, { total: number; correct: number; score: number; full: number }> = {
    single: { total: 0, correct: 0, score: 0, full: 0 },
    multiple: { total: 0, correct: 0, score: 0, full: 0 },
    judge: { total: 0, correct: 0, score: 0, full: 0 },
    fill: { total: 0, correct: 0, score: 0, full: 0 },
    essay: { total: 0, correct: 0, score: 0, full: 0 },
  }
  const wrongList: { qid: string; stem: string; mine: string[]; right: string[] }[] = []
  for (const q of paper.questions) {
    const ua = answers[q.qid] ?? []
    const ok = isCorrect(q, ua)
    const b = byType[q.type]
    b.total += 1
    b.full += SCORE[q.type]
    if (ok) { b.correct += 1; b.score += SCORE[q.type] }
    else wrongList.push({ qid: q.qid, stem: q.stem, mine: ua, right: q.answer })
  }

  return (
    <>
      <TopBar title="考试成绩" sub={meta?.name} />
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="tiny muted">得分</div>
          <div style={{ fontSize: '2.6rem', fontWeight: 700, lineHeight: 1.2 }}>
            {score}
            <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 400 }}> / {paper.fullScore}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 2 }}>得分率 {pct}%</div>
          <div className="grid3" style={{ marginTop: 14 }}>
            <div className="stat"><b>{correctCount}/{total}</b><span>正确</span></div>
            <div className="stat"><b>{answered}</b><span>已答</span></div>
            <div className="stat"><b>{minutes}′</b><span>用时</span></div>
          </div>
        </div>

        <div className="card">
          <h2>分题型</h2>
          {(['single', 'multiple', 'judge'] as QType[]).filter((t) => byType[t].total > 0).map((t) => {
            const b = byType[t]
            const p = Math.round((b.correct / b.total) * 100)
            return (
              <div key={t} style={{ marginBottom: 12 }}>
                <div className="row between small">
                  <span>{TYPE_LABEL[t]} {b.correct}/{b.total}</span>
                  <span className="muted">{b.score}/{b.full} 分</span>
                </div>
                <div className="bar ok" style={{ marginTop: 5 }}><i style={{ width: `${p}%` }} /></div>
              </div>
            )
          })}
        </div>

        {wrongList.length > 0 && (
          <div className="card">
            <h2>错题 {wrongList.length} 道（已进错题本）</h2>
            <div className="list">
              {wrongList.map((w, i) => {
                const q = paper.questions.find((x) => x.qid === w.qid)!
                return (
                  <div key={w.qid} className="card tight" style={{ marginBottom: 0 }}>
                    <div className="tiny muted">第 {i + 1} 题 · {TYPE_LABEL[q.type]}</div>
                    <div className="small" style={{ margin: '4px 0 6px', whiteSpace: 'pre-wrap' }}>{w.stem}</div>
                    <div className="tiny" style={{ color: 'var(--bad)' }}>你的答案：{w.mine.length ? w.mine.join(' ') : '未作答'}</div>
                    <div className="tiny" style={{ color: 'var(--ok)' }}>正确答案：{answerText(q)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid2" style={{ marginTop: 6 }}>
          <button className="btn" onClick={() => go({ name: 'wrong', sid })}>看错题本</button>
          <button className="btn primary" onClick={() => go({ name: 'exam', sid })}>再考一次</button>
        </div>
        <div style={{ height: 10 }} />
        <button className="btn block ghost" onClick={back}>返回科目</button>
      </div>
    </>
  )
}
