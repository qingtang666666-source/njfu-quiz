import { useEffect, useMemo, useState } from 'react'
import { TopBar, useApp } from '../App'
import { db } from '../db/db'
import { ensureSubjectLoaded } from '../db/repo'
import { TYPE_LABEL, type Question } from '../domain/types'

export default function Search() {
  const { subjects, toast } = useApp()
  const [sid, setSid] = useState('')
  const [kw, setKw] = useState('')
  const [all, setAll] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    if (!sid && subjects.length) setSid(subjects[0].id)
  }, [subjects, sid])

  useEffect(() => {
    if (!sid) return
    const meta = subjects.find((s) => s.id === sid)
    if (!meta) return
    setLoading(true)
    void (async () => {
      try {
        await ensureSubjectLoaded(meta)
        setAll(await db.questions.where('subjectId').equals(sid).toArray())
      } catch (e) {
        toast(`加载失败：${e instanceof Error ? e.message : e}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [sid, subjects, toast])

  const hits = useMemo(() => {
    const k = kw.trim()
    if (!k) return []
    const lower = k.toLowerCase()
    return all.filter((q) => q.stem.toLowerCase().includes(lower)
      || q.options.some((o) => o.text.toLowerCase().includes(lower)))
  }, [all, kw])

  return (
    <>
      <TopBar title="搜索题目" />
      <div className="page">
        <select className="search" value={sid} onChange={(e) => { setSid(e.target.value); setLimit(50) }}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.count} 题）</option>)}
        </select>
        <input
          className="search"
          placeholder="输入题干或选项关键词"
          value={kw}
          onChange={(e) => { setKw(e.target.value); setLimit(50) }}
          autoFocus
        />

        {loading && <div className="loading">正在加载该科目题目…</div>}

        {!loading && kw.trim() && (
          <div className="tiny muted" style={{ marginBottom: 8 }}>
            命中 {hits.length} 题{all.length > 0 ? `（本科目共 ${all.length} 题）` : ''}
          </div>
        )}

        <div className="list">
          {hits.slice(0, limit).map((q) => (
            <div key={q.qid} className="card tight" style={{ marginBottom: 0 }}>
              <div className="tiny muted">
                {TYPE_LABEL[q.type]} · ID {q.serverId} · 答案 {q.answer.join('')}
              </div>
              <div className="small" style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{q.stem}</div>
              {q.options.map((o) => (
                <div key={o.key} className="tiny" style={{ color: q.answer.includes(o.key) ? 'var(--ok)' : 'var(--muted)' }}>
                  {o.key}. {o.text}
                </div>
              ))}
            </div>
          ))}
        </div>

        {hits.length > limit && (
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => setLimit((n) => n + 50)}>
            再看 50 条（还有 {hits.length - limit} 条）
          </button>
        )}

        {!kw.trim() && !loading && (
          <div className="empty">输入关键词开始搜索。搜索只在当前科目内进行。</div>
        )}
      </div>
    </>
  )
}
