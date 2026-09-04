const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cinder", {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onWindowState: (cb) => ipcRenderer.on("window:state", (_e, v) => cb(v)),
  setBackground: (bg) => ipcRenderer.send("theme:background", bg),
  collect: () => ipcRenderer.invoke("usage:collect"),
  calls: () => ipcRenderer.invoke("usage:calls"),
  cancelScan: () => ipcRenderer.invoke("usage:cancel"),
  onScanProgress: (cb) => ipcRenderer.on("usage:progress", (_e, p) => cb(p)),
  onMenuRescan: (cb) => ipcRenderer.on("menu:rescan", () => cb()),
  snapshotInfo: () => ipcRenderer.invoke("snapshot:info"),
  snapshotUsage: () => ipcRenderer.invoke("snapshot:usage"),
  snapshotCalls: () => ipcRenderer.invoke("snapshot:calls"),
  clearSnapshot: () => ipcRenderer.invoke("snapshot:clear"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url)
});
