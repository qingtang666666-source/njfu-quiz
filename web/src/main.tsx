import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 离线缓存失败不影响使用 */
    })
  })
}

// 安卓返回键：优先走应用内返回，到首页才退出
void (async () => {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { App: CapApp } = await import('@capacitor/app')
    await CapApp.addListener('backButton', () => {
      const handler = (window as unknown as { __njfuBack?: () => boolean }).__njfuBack
      if (!handler || handler() === false) void CapApp.exitApp()
    })
  } catch {
    /* 网页版没有 Capacitor，忽略 */
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
