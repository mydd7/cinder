const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("au", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onWindowState: (cb) => ipcRenderer.on("window:state", (_e, v) => cb(v)),
  collect: () => ipcRenderer.invoke("usage:collect"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url)
});
