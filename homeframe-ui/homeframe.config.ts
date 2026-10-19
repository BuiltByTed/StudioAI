import { defineHomeframe } from '@builtbyted/homeframe/vite';

export default defineHomeframe({
  app: {
    id: '/',
    name: 'Studio AI',
    shortName: 'Studio AI',
    description: 'Your personal AI workspace, built by Ted.',
    startUrl: '/',
    scope: '/',
    display: 'standalone',
    colorScheme: 'system',
    themeColor: '#faf9f6',
    themeColorDark: '#171918',
    backgroundColor: '#faf9f6',
    backgroundColorDark: '#171918',
    icon: './brand/icon.svg',
    shareTarget: { action: '/', method: 'GET', params: { text: 'shared' } },
  },
  splash: {
    title: 'Studio AI',
    logo: './brand/icon.svg',
    generateAppleStartupImages: true,
    appleStatusBarStyle: 'default',
  },
  viewport: {
    selection: 'allow-desktop',
    snapshot: 'privacy',
    bottomDock: 'avoid',
    strictInputZoom: true,
  },
  router: { historyMode: 'auto' },
  nudges: { install: { minSessions: 2, minEngagedMs: 30000 }, notifications: { enabled: false } },
  serviceWorker: {
    fileName: 'sw.js',
    update: { mode: 'prompt', reload: 'safe-point' },
    navigationDeny: [
      '/api/',
      '/openai/',
      '/ollama/',
      '/ws/',
      '/oauth/',
      '/static/',
      '/cache/',
      '/pyodide/',
    ],
    notifications: false,
  },
});
