// Note: Exposing IPC to renderer (Trigger Rebuild 2)
// import { ipcRenderer, contextBridge } from 'electron'
const { ipcRenderer, contextBridge } = require('electron')

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: any[]) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event: any, ...args: any[]) => listener(event, ...args))
  },
  off(...args: any[]) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: any[]) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: any[]) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
