import { useEffect, useState } from 'react'
import { TopBar, useApp } from '../App'
import { db } from '../db/db'
import { recentSessions, subjectStats, type SubjectStats } from '../db/repo'

const MODE_LABEL: Record<string, string> = {
  sequential: '顺序', random: '随机', wrong: '错题', star: '收藏', exam: '模考',
}

export default function Stats() {
  const { subjects } = useApp()
  const [stats, setStats] = useState<Record<string, SubjectStats>>({})
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof recentSessions>>>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const out: Record<string, SubjectStats> = {}
      for (const s of subjects) {
        const loaded = await db.subjects.get(s.id)
        if (!loaded) continue
        out[s.id] = await subjectStats(s.id)
      }
      const ss = await recentSessions(20)
      if (alive) { setStats(out); setSessions(ss) }
    })()
    return () => { alive = false }
  }, [subjects])

  const totals = Object.values(stats).reduce(
    (a, s) => ({ total: a.total + s.total, answered: a.answered + s.answered, correct: a.correct + s.correct }),
    { total: 0, answered: 0, correct: 0 },
  )
  const acc = totals.answered ? Math.round((totals.correct / totals.answered) * 1000) / 10 : 0

  return (
    <>
      <TopBar title="学习统计" />
      <div className="page">
        <div className="grid3" style={{ marginBottom: 12 }}>
          <div className="stat"><b>{totals.answered}</b><span>总已答</span></div>
          <div className="stat"><b>{acc}%</b><span>总正确率</span></div>
          <div className="stat"><b>{totals.total - totals.answered}</b><span>未做</span></div>
        </div>

        <div className="card">
          <h2>分科目</h2>
          {Object.keys(stats).length === 0 && <div className="tiny muted">还没有做过题。</div>}
          {subjects.map((s) => {
            const st = stats[s.id]
            if (!st) return null
            const p = Math.round(st.accuracy * 100)
            const done = st.total ? Math.round((st.answered / st.total) * 100) : 0
            return (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div className="row between small">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%' }}>{s.name}</span>
                  <span className="muted mono">{st.answered}/{st.total} · {st.answered ? `${p}%` : '—'}</span>
                </div>
                <div className="bar" style={{ marginTop: 5 }}><i style={{ width: `${done}%` }} /></div>
                <div className="tiny muted" style={{ marginTop: 3 }}>
                  单选 {st.byType.single.correct}/{st.byType.single.total}
                  {' · '}多选 {st.byType.multiple.correct}/{st.byType.multiple.total}
                  {' · '}判断 {st.byType.judge.correct}/{st.byType.judge.total}
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h2>最近记录</h2>
          {sessions.length === 0 && <div className="tiny muted">暂无记录。</div>}
          <div className="list">
            {sessions.map((s) => (
              <div key={s.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>
                  <span className="badge">{MODE_LABEL[s.mode] ?? s.mode}</span>{' '}
                  {new Date(s.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="muted mono">
                  {s.correct}/{s.answered || s.total}
                  {s.score != null ? ` · ${s.score} 分` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
