const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinder", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onWindowState: (cb) => ipcRenderer.on("window:state", (_e, v) => cb(v)),
  setBackground: (bg) => ipcRenderer.send("theme:background", bg),
  collect: () => ipcRenderer.invoke("usage:collect"),
  calls: () => ipcRenderer.invoke("usage:calls"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url)
});
