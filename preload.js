const { contextBridge, ipcRenderer } = require("electron");

function listen(channel, cb) {
  const fn = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
}

contextBridge.exposeInMainWorld("cinder", {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onWindowState: (cb) => listen("window:state", cb),
  setBackground: (bg) => ipcRenderer.send("theme:background", bg),
  collect: () => ipcRenderer.invoke("usage:collect"),
  calls: () => ipcRenderer.invoke("usage:calls"),
  cancelScan: () => ipcRenderer.invoke("usage:cancel"),
  onScanProgress: (cb) => listen("usage:progress", cb),
  onMenuRescan: (cb) => listen("menu:rescan", cb),
  snapshotInfo: () => ipcRenderer.invoke("snapshot:info"),
  snapshotUsage: () => ipcRenderer.invoke("snapshot:usage"),
  snapshotCalls: () => ipcRenderer.invoke("snapshot:calls"),
  clearSnapshot: () => ipcRenderer.invoke("snapshot:clear")
});
