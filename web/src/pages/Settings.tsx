import { useEffect, useRef, useState } from 'react'
import { TopBar, useApp } from '../App'
import { db } from '../db/db'
import { exportAll, getMastery, importAll, setMastery, setMeta, storageEstimate } from '../db/repo'
import { getMeta } from '../db/repo'

export default function Settings() {
  const { theme, setTheme, toast, reload } = useApp()
  const [scale, setScale] = useState(100)
  const [mastery, setMasteryState] = useState(2)
  const [usage, setUsage] = useState<string>('—')
  const [counts, setCounts] = useState({ subjects: 0, questions: 0, progress: 0, wrongs: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const s = await getMeta<number>('fontScale', 100)
      setMasteryState(await getMastery())
      setScale(s)
      document.documentElement.style.fontSize = `${16 * (s / 100)}px`
      const [subjects, questions, progress, wrongs] = await Promise.all([
        db.subjects.count(), db.questions.count(), db.progress.count(), db.wrongs.count(),
      ])
      setCounts({ subjects, questions, progress, wrongs })
      const est = await storageEstimate()
      if (est) setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB`)
    })()
  }, [])

  const applyScale = async (v: number) => {
    setScale(v)
    document.documentElement.style.fontSize = `${16 * (v / 100)}px`
    await setMeta('fontScale', v)
  }

  return (
    <>
      <TopBar title="设置" />
      <div className="page">
        <div className="card">
          <h2>外观</h2>
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="small">主题</span>
            <div className="seg">
              <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>浅色</button>
              <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>深色</button>
            </div>
          </div>
          <div className="row between">
            <span className="small">字号</span>
            <div className="seg">
              {[90, 100, 115].map((v) => (
                <button key={v} className={scale === v ? 'on' : ''} onClick={() => void applyScale(v)}>
                  {v === 90 ? '小' : v === 100 ? '中' : '大'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>错题重做</h2>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="small">移出错题本所需连对次数</span>
            <div className="seg">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={mastery === n ? 'on' : ''}
                  onClick={async () => { setMasteryState(n); await setMastery(n); toast(`改为连续答对 ${n} 次移出`) }}
                >
                  {n} 次
                </button>
              ))}
            </div>
          </div>
          <div className="tiny muted">
            答错一次连对清零，重新计。设为 1 次时，答对即移出。
          </div>
        </div>

        <div className="card">
          <h2>本机数据</h2>
          <div className="tiny muted" style={{ lineHeight: 2 }}>
            已导入科目 {counts.subjects} 个 · 题目 {counts.questions} 题<br />
            作答记录 {counts.progress} 条 · 错题 {counts.wrongs} 条<br />
            占用空间 {usage}（浏览器 IndexedDB）
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <button
              className="btn"
              onClick={async () => {
                const data = await exportAll()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `njfu-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(a.href)
                toast('已导出备份')
              }}
            >
              导出备份
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>导入备份</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const data = JSON.parse(await f.text())
                if (data.schema !== 'njfu-quiz-backup/v1') throw new Error('不是本应用的备份文件')
                await importAll(data)
                toast('导入完成')
                setTimeout(() => window.location.reload(), 600)
              } catch (err) {
                toast(`导入失败：${err instanceof Error ? err.message : err}`)
              } finally {
                e.target.value = ''
              }
            }}
          />
        </div>

        <div className="card">
          <h2>危险操作</h2>
          <button
            className="btn block"
            onClick={async () => {
              if (!confirm('清空全部作答记录、错题、收藏和考试记录？题目本身会保留。')) return
              await db.transaction('rw', db.progress, db.wrongs, db.stars, db.sessions, db.attempts, async () => {
                await Promise.all([
                  db.progress.clear(), db.wrongs.clear(), db.stars.clear(),
                  db.sessions.clear(), db.attempts.clear(),
                ])
              })
              toast('已清空学习记录')
              reload()
            }}
          >
            清空全部学习记录
          </button>
          <div style={{ height: 8 }} />
          <button
            className="btn block"
            onClick={async () => {
              if (!confirm('删除全部题库缓存（题目 + 记录）？下次打开需要重新导入。')) return
              await db.delete()
              indexedDB.deleteDatabase('njfu-quiz')
              window.location.reload()
            }}
          >
            删除全部本地数据
          </button>
        </div>

        <div className="card">
          <h2>关于</h2>
          <div className="tiny muted" style={{ lineHeight: 1.9 }}>
            作者：青棠<br />
            题库版本：2026（7 门，9013 题）<br />
            数据来源：本机抓取的题库快照，只读不改<br />
            所有数据保存在浏览器本地，不上传任何服务器。<br />
            键盘：A–F 选项，Enter 确认/下一题，← → 翻页。
          </div>
        </div>
      </div>
    </>
  )
}
