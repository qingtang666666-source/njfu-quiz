import { useEffect, useState } from 'react'
import { TopBar, subjectById, useApp } from '../App'
import { useSubject } from '../components/useSubject'
import { getMastery, listWrong, removeWrong } from '../db/repo'
import { answerText } from '../domain/grade'
import { TYPE_LABEL } from '../domain/types'

export default function Wrong({ sid }: { sid: string }) {
  const { subjects, go, toast } = useApp()
  const meta = subjectById(subjects, sid)
  const { questions, loading, reload } = useSubject(meta, sid)
  const [rows, setRows] = useState<{ qid: string; count: number; streak: number; lastAt: number }[]>([])
  const [mastery, setMastery] = useState(2)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    void listWrong(sid).then((r) => setRows(r.sort((a, b) => b.count - a.count)))
    void getMastery().then(setMastery)
  }, [sid, loading])

  const map = new Map(questions.map((q) => [q.qid, q]))

  return (
    <>
      <TopBar title="错题本" sub={meta?.name} />
      <div className="page">
        {loading && <div className="loading">加载中…</div>}
        {!loading && rows.length === 0 && (
          <div className="empty">错题本是空的。答错的题会自动收进来。</div>
        )}
        {!loading && rows.length > 0 && (
          <>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="small muted">共 {rows.length} 题，按错误次数排序（连对 {mastery} 次自动移出）</span>
              <button className="btn sm primary" onClick={() => go({ name: 'practice', sid, mode: 'wrong' })}>开始错题重做</button>
            </div>
            <div className="list">
              {rows.map((r) => {
                const q = map.get(r.qid)
                if (!q) return null
                const isOpen = open === r.qid
                return (
                  <div key={r.qid} className="card tight" style={{ marginBottom: 0 }}>
                    <div className="row between" style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="tiny muted">
                          {TYPE_LABEL[q.type]} · 错 {r.count} 次 · 连对 {r.streak ?? 0}/{mastery} · ID {q.serverId}
                        </div>
                        <div className="small" style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{q.stem}</div>
                      </div>
                      <button className="btn sm ghost" onClick={() => setOpen(isOpen ? null : r.qid)}>
                        {isOpen ? '收起' : '答案'}
                      </button>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8 }}>
                        {q.options.map((o) => (
                          <div key={o.key} className="tiny" style={{ color: q.answer.includes(o.key) ? 'var(--ok)' : 'var(--muted)' }}>
                            {o.key}. {o.text}
                          </div>
                        ))}
                        <div className="tiny" style={{ marginTop: 6, color: 'var(--ok)' }}>正确答案：{answerText(q)}</div>
                        <button
                          className="btn sm ghost"
                          style={{ marginTop: 8 }}
                          onClick={async () => {
                            await removeWrong(sid, r.qid)
                            setRows((prev) => prev.filter((x) => x.qid !== r.qid))
                            reload()
                            toast('已移出错题本')
                          }}
                        >
                          移出错题本
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
