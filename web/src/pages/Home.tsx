import { useEffect, useState } from 'react'
import { TopBar, useApp } from '../App'
import { db } from '../db/db'
import { subjectStats, type SubjectStats } from '../db/repo'

export default function Home() {
  const { subjects, loading, error, go, reload } = useApp()
  const [stats, setStats] = useState<Record<string, SubjectStats>>({})
  const [totals, setTotals] = useState({ answered: 0, correct: 0, wrong: 0 })

  useEffect(() => {
    let alive = true
    ;(async () => {
      const out: Record<string, SubjectStats> = {}
      let answered = 0
      let correct = 0
      for (const s of subjects) {
        const loaded = await db.subjects.get(s.id)
        if (!loaded) continue
        const st = await subjectStats(s.id)
        out[s.id] = st
        answered += st.answered
        correct += st.correct
      }
      const wrong = await db.wrongs.toArray()
      if (alive) {
        setStats(out)
        setTotals({ answered, correct, wrong: wrong.filter((w) => !w.cleared).length })
      }
    })()
    return () => { alive = false }
  }, [subjects])

  const total = subjects.reduce((s, x) => s + x.count, 0)
  const accuracy = totals.answered ? Math.round((totals.correct / totals.answered) * 1000) / 10 : 0

  return (
    <>
      <TopBar
        title="NJFU 刷题"
        sub={total ? `${subjects.length} 门 · ${total} 题` : undefined}
        onBack={() => undefined}
        right={
          <div className="row" style={{ gap: 6 }}>
            <button className="iconbtn" onClick={() => go({ name: 'stats' })} title="统计">统计</button>
            <button className="iconbtn" onClick={() => go({ name: 'settings' })} title="设置">设置</button>
          </div>
        }
      />
      <div className="page">
        {loading && <div className="loading">正在加载题库索引…</div>}
        {error && (
          <div className="card">
            <div style={{ marginBottom: 8 }}>题库加载失败：{error}</div>
            <button className="btn" onClick={reload}>重试</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid3" style={{ marginBottom: 12 }}>
              <div className="stat"><b>{totals.answered}</b><span>已答</span></div>
              <div className="stat"><b>{accuracy}%</b><span>正确率</span></div>
              <div className="stat"><b>{totals.wrong}</b><span>错题</span></div>
            </div>

            <div className="row between" style={{ margin: '4px 2px 10px' }}>
              <h2 style={{ margin: 0 }}>选择科目</h2>
              <button className="btn sm ghost" onClick={() => go({ name: 'search' })}>搜索题目</button>
            </div>

            {subjects.map((s) => {
              const st = stats[s.id]
              const pct = st && st.total ? Math.round((st.answered / st.total) * 100) : 0
              return (
                <div key={s.id} className="card subject-card" onClick={() => go({ name: 'subject', sid: s.id })}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="subject-name">{s.name}</div>
                      <div className="tiny muted" style={{ marginTop: 2 }}>
                        {s.count} 题 · {s.term} 版 {s.version}
                        {st ? ` · 已答 ${st.answered}` : ''}
                        {st && st.answered ? ` · 正确率 ${Math.round(st.accuracy * 100)}%` : ''}
                      </div>
                    </div>
                    <div className="badge">完成 {pct}%</div>
                  </div>
                  <div className="bar" style={{ marginTop: 10 }}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}

            <div className="tiny muted" style={{ textAlign: 'center', marginTop: 18, lineHeight: 2 }}>
              题库来自 2026 版，共 {total} 题；数据只存本机，不上传。<br />
              作者 青棠
            </div>
          </>
        )}
      </div>
    </>
  )
}
