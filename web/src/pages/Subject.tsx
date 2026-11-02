import { useEffect, useState } from 'react'
import { TopBar, subjectById, useApp } from '../App'
import { useSubject } from '../components/useSubject'
import { getMastery, listWrong, resetSubject, starSet } from '../db/repo'

export default function Subject({ sid }: { sid: string }) {
  const { subjects, go, back, toast } = useApp()
  const meta = subjectById(subjects, sid)
  const { stats, loading, questions, reload } = useSubject(meta, sid)
  const [wrongN, setWrongN] = useState(0)
  const [starN, setStarN] = useState(0)
  const [mastery, setMastery] = useState(2)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [w, s, m] = await Promise.all([listWrong(sid), starSet(sid), getMastery()])
      if (alive) { setWrongN(w.length); setStarN(s.size); setMastery(m) }
    })()
    return () => { alive = false }
  }, [sid, stats])

  if (!meta) {
    return <><TopBar title="题库" /><div className="page"><div className="empty">题库不存在</div></div></>
  }

  const pct = stats && stats.total ? Math.round((stats.answered / stats.total) * 100) : 0

  return (
    <>
      <TopBar title={meta.name} sub={`${meta.count} 题`} />
      <div className="page">
        {loading && <div className="loading">正在导入题目到本机…</div>}

        <div className="card">
          <div className="row between">
            <div>
              <div className="tiny muted">已答 / 总题</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>
                {stats?.answered ?? 0} / {stats?.total ?? meta.count}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tiny muted">正确率</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>
                {stats && stats.answered ? `${Math.round(stats.accuracy * 100)}%` : '—'}
              </div>
            </div>
          </div>
          <div className="bar ok" style={{ marginTop: 12 }}><i style={{ width: `${pct}%` }} /></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            单选 {stats?.byType.single.total ?? meta.byType.single ?? 0}
            {' · '}多选 {stats?.byType.multiple.total ?? meta.byType.multiple ?? 0}
            {' · '}判断 {stats?.byType.judge.total ?? meta.byType.judge ?? 0}
          </div>
        </div>

        <div className="grid2" style={{ marginBottom: 12 }}>
          <button className="btn primary block" disabled={loading} onClick={() => go({ name: 'practice', sid, mode: 'sequential' })}>
            顺序练习
          </button>
          <button className="btn block" disabled={loading} onClick={() => go({ name: 'practice', sid, mode: 'random' })}>
            随机练习
          </button>
          <button className="btn block" disabled={loading} onClick={() => go({ name: 'exam', sid })}>
            模拟考试
          </button>
          <button className="btn block" disabled={!wrongN} onClick={() => go({ name: 'wrong', sid })}>
            错题本 {wrongN ? `(${wrongN})` : ''}
          </button>
        </div>

        {wrongN > 0 && (
          <button
            className="btn primary block"
            style={{ marginBottom: 12 }}
            onClick={() => go({ name: 'practice', sid, mode: 'wrong' })}
          >
            错题重做（{wrongN} 题，连续答对 {mastery} 次移出）
          </button>
        )}

        {starN > 0 && (
          <button className="btn block" style={{ marginBottom: 12 }} onClick={() => go({ name: 'practice', sid, mode: 'star' })}>
            收藏练习（{starN}）
          </button>
        )}

        <div className="card tight">
          <div className="row between">
            <div className="small muted">题库版本 {meta.version}</div>
            <button
              className="btn sm ghost"
              onClick={async () => {
                if (!confirm(`清空《${meta.name}》的全部作答记录、错题和收藏？题目本身不受影响。`)) return
                await resetSubject(sid)
                reload()
                setWrongN(0)
                setStarN(0)
                toast('已清空该科目的作答记录')
              }}
            >
              清空记录
            </button>
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            共 {questions.length} 题已存本机，可离线使用。
          </div>
        </div>

        <div className="tiny muted" style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn sm ghost" onClick={back}>返回科目列表</button>
        </div>
      </div>
    </>
  )
}
