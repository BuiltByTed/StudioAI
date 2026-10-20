import { defineHomeframe } from '@builtbyted/homeframe/vite';

export default defineHomeframe({
  app: {
    id: '/', name: 'Studio AI', shortName: 'Studio AI',
    startUrl: '/', scope: '/', display: 'standalone', colorScheme: 'system',
    themeColor: '#ffffff', themeColorDark: '#171717',
    backgroundColor: '#ffffff', backgroundColorDark: '#171717',
    icon: '../static/static/favicon.svg',
    shareTarget: { action: '/', method: 'GET', params: { text: 'shared' } },
  },
  splash: {
    title: '', logo: '../static/static/favicon.svg',
    generateAppleStartupImages: true, appleStatusBarStyle: 'default',
  },
  viewport: { selection: 'allow-desktop', snapshot: 'privacy', bottomDock: 'avoid', strictInputZoom: true },
  nudges: { install: { minSessions: 2, minEngagedMs: 30000 }, notifications: { enabled: false } },
  serviceWorker: {
    fileName: 'sw.js', update: { mode: 'prompt', reload: 'safe-point' },
    navigationDeny: ['/api/', '/openai/', '/ollama/', '/ws/', '/oauth/', '/static/', '/cache/', '/pyodide/'],
    // Emoji artwork is optional content, fetched when its picker is used.
    // Preloading thousands of images delays installation of the actual shell.
    precache: { exclude: [/\.map$/, /^assets\/emojis\//] },
    notifications: false,
  },
});
