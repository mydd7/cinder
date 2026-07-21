const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { collect } = require("./main/collect");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: "#0b0d0f",
    title: "A\\ Usage",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  if (process.env.AU_DEV) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }
  win.once("ready-to-show", () => win.show());

  win.on("maximize", () => win.webContents.send("window:state", true));
  win.on("unmaximize", () => win.webContents.send("window:state", false));
}

ipcMain.handle("window:minimize", () => win && win.minimize());
ipcMain.handle("window:toggle-maximize", () => {
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});
ipcMain.handle("window:close", () => win && win.close());
ipcMain.handle("window:is-maximized", () => (win ? win.isMaximized() : false));

ipcMain.handle("usage:collect", async () => {
  try {
    return await collect();
  } catch (err) {
    return { entries: [], sources: [], error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle("app:open-external", (_e, url) => shell.openExternal(url));

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
