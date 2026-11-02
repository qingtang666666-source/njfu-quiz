import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.njfu.quiz',
  appName: 'NJFU刷题',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f5f6f8',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
