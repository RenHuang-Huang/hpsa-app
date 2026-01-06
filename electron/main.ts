import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'

process.on('uncaughtException', (error) => {
  const logPath = path.join(process.cwd(), 'crash.log')
  const message = `[${new Date().toISOString()}] CRASH: ${error.message}\nStack: ${error.stack}\n`
  // Try to write using Sync to ensure it saves before exit
  try {
    fs.appendFileSync(logPath, message)
  } catch (e) {
    // desperate fallback
  }

  // Show error dialog if possible
  dialog.showErrorBox('Application Crash', error.message + '\n\nSee crash.log for details.')
  process.exit(1)
})

// import { createRequire } from 'node:module'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    title: '糞便抗原檢驗輸入系統',
    autoHideMenuBar: true, // Hide menu bar
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.bundled.cjs'),
      contextIsolation: true,
      sandbox: false, // Ensure Node APIs (require) work in preload
    },
    show: false, // Don't show until maximized
  })

  win.maximize();
  win.show();

  console.log('[Main] Preload path configured:', path.resolve(__dirname, 'preload.bundled.cjs'));


  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

import { initDb } from './db'
import { setupIpc } from './ipc'

app.whenReady().then(() => {
  initDb()
  setupIpc()
  createWindow()
})
