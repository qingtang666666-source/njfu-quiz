import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { host: true, port: 5173, allowedHosts: true },
  preview: { host: true, port: 4173, allowedHosts: true },
  build: { target: 'es2020' },
  test: { environment: 'node', globals: true, include: ['tests/**/*.test.ts'] },
} as any)
