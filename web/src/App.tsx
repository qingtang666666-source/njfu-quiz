import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Home from './pages/Home'
import Subject from './pages/Subject'
import Practice from './pages/Practice'
import Exam from './pages/Exam'
import Result, { type ExamResult } from './pages/Result'
import Wrong from './pages/Wrong'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Search from './pages/Search'
import { getMeta, setMeta } from './db/repo'
import type { SubjectMeta } from './domain/types'

export type View =
  | { name: 'home' }
  | { name: 'subject'; sid: string }
  | { name: 'practice'; sid: string; mode: 'sequential' | 'random' | 'wrong' | 'star'; startQid?: string }
  | { name: 'exam'; sid: string }
  | { name: 'result'; sid: string; result: ExamResult }
  | { name: 'wrong'; sid: string }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'search' }

export interface AppCtx {
  subjects: SubjectMeta[]
  loading: boolean
  error: string | null
  go: (v: View) => void
  back: () => void
  toast: (msg: string) => void
  theme: 'light' | 'dark'
  setTheme: (t: 'light' | 'dark') => void
  reload: () => void
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('AppCtx missing')
  return v
}

export function subjectById(subjects: SubjectMeta[], sid: string) {
  return subjects.find((s) => s.id === sid)
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [, setStack] = useState<View[]>([])
  const [subjects, setSubjects] = useState<SubjectMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [theme, setThemeState] = useState<'light' | 'dark'>('light')
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL || '/'}data/subjects.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSubjects(data.subjects ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void getMeta<'light' | 'dark'>('theme', 'light').then((t) => {
      setThemeState(t)
      document.documentElement.dataset.theme = t
    })
  }, [load])

  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t)
    document.documentElement.dataset.theme = t
    void setMeta('theme', t)
  }, [])

  const toast = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2200)
  }, [])

  const go = useCallback((v: View) => {
    setView((cur) => {
      setStack((s) => [...s, cur])
      return v
    })
  }, [])

  const back = useCallback(() => {
    setStack((s) => {
      if (!s.length) {
        setView({ name: 'home' })
        return s
      }
      setView(s[s.length - 1])
      return s.slice(0, -1)
    })
  }, [])

  // 给安卓返回键用：首页返回 false（退出应用），其它页返回 true
  useEffect(() => {
    ;(window as unknown as { __njfuBack?: () => boolean }).__njfuBack = () => {
      if (view.name === 'home') return false
      back()
      return true
    }
  }, [view, back])

  useEffect(() => {
    const onPop = () => back()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [back])

  const ctx = useMemo<AppCtx>(() => ({
    subjects, loading, error, go, back, toast, theme, setTheme, reload: load,
  }), [subjects, loading, error, go, back, toast, theme, setTheme, load])

  let body: ReactNode = null
  switch (view.name) {
    case 'home':
      body = <Home />
      break
    case 'subject':
      body = <Subject sid={view.sid} />
      break
    case 'practice':
      body = <Practice sid={view.sid} mode={view.mode} startQid={view.startQid} />
      break
    case 'exam':
      body = <Exam sid={view.sid} />
      break
    case 'result':
      body = <Result sid={view.sid} result={view.result} />
      break
    case 'wrong':
      body = <Wrong sid={view.sid} />
      break
    case 'stats':
      body = <Stats />
      break
    case 'settings':
      body = <Settings />
      break
    case 'search':
      body = <Search />
      break
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">{body}</div>
      {msg && <div className="toast">{msg}</div>}
    </Ctx.Provider>
  )
}

export function TopBar({ title, sub, onBack, right }: {
  title: string
  sub?: string
  onBack?: () => void
  right?: ReactNode
}) {
  const { back } = useApp()
  return (
    <div className="topbar">
      <button className="iconbtn" onClick={onBack ?? back} aria-label="返回">←</button>
      <h1>{title}{sub && <span className="sub">{sub}</span>}</h1>
      {right}
    </div>
  )
}
