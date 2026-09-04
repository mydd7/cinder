const { app, BrowserWindow, Menu, ipcMain, screen, shell, utilityProcess } = require("electron");
const fs = require("fs");
const path = require("path");
const { readSnapshot, snapshotInfo, writeSnapshot, clearSnapshot } = require("./main/snapshot");

const ICON = path.join(__dirname, "icon", process.platform === "win32" ? "icon.ico" : "icon.png");
const DEFAULT_BG = "#1f1e1d";

let win = null;
let state = { width: 1200, height: 800, bg: DEFAULT_BG };
let saveTimer = null;

function statePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (raw && typeof raw === "object") state = { ...state, ...raw };
  } catch {}
  if (typeof state.bg !== "string" || !/^#[0-9a-f]{3,8}$/i.test(state.bg)) state.bg = DEFAULT_BG;
}

function onVisibleDisplay(bounds) {
  if (typeof bounds.x !== "number" || typeof bounds.y !== "number") return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return bounds.x < a.x + a.width && bounds.x + 80 > a.x && bounds.y < a.y + a.height && bounds.y + 40 > a.y;
  });
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  state = { ...state, x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
  try {
    const tmp = statePath() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, statePath());
  } catch {}
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 400);
}

function createWindow() {
  const opts = {
    width: Math.max(940, state.width || 1200),
    height: Math.max(600, state.height || 800),
    minWidth: 940,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: state.bg,
    icon: ICON,
    title: "Cinder",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webviewTag: false
    }
  };
  if (onVisibleDisplay(state)) {
    opts.x = state.x;
    opts.y = state.y;
  }

  win = new BrowserWindow(opts);
  if (state.maximized) win.maximize();

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault();
  });

  if (process.env.AU_DEV) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  win.once("ready-to-show", () => win.show());
  win.webContents.on("render-process-gone", (_e, details) => {
    if (details.reason === "clean-exit" || !win || win.isDestroyed()) return;
    console.error("renderer gone:", details.reason);
    win.webContents.reload();
  });
  win.on("maximize", () => {
    win.webContents.send("window:state", true);
    queueSave();
  });
  win.on("unmaximize", () => {
    win.webContents.send("window:state", false);
    queueSave();
  });
  win.on("resize", queueSave);
  win.on("move", queueSave);
  win.on("close", saveState);
}

function openExternal(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol === "http:" || u.protocol === "https:") return shell.openExternal(u.href);
  } catch {}
}

function appMenu() {
  if (process.platform !== "darwin") return null;
  return Menu.buildFromTemplate([
    { role: "appMenu" },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    }
  ]);
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

ipcMain.on("theme:background", (_e, bg) => {
  if (typeof bg === "string" && /^#[0-9a-f]{3,8}$/i.test(bg) && bg !== state.bg) {
    state.bg = bg;
    queueSave();
  }
});

let nextJob = 1;

function createPool(serviceName) {
  const pool = { proc: null, jobs: new Map() };

  pool.settleAll = (make) => {
    for (const job of pool.jobs.values()) job.resolve(make(job));
    pool.jobs.clear();
  };

  pool.ensure = () => {
    if (pool.proc) return pool.proc;
    const proc = utilityProcess.fork(path.join(__dirname, "main", "scan-worker.js"), [], {
      serviceName,
      execArgv: ["--max-old-space-size=4096"]
    });
    pool.proc = proc;
    proc.on("message", (msg) => {
      if (!msg || typeof msg !== "object") return;
      const job = pool.jobs.get(msg.id);
      if (!job) return;
      if (msg.type === "progress") {
        if (win && !win.isDestroyed()) win.webContents.send("usage:progress", msg.progress);
        return;
      }
      pool.jobs.delete(msg.id);
      if (msg.type === "done") job.resolve(msg.result);
      else job.resolve({ ...job.fallback, error: msg.message });
    });
    proc.on("exit", (code) => {
      if (pool.proc !== proc) return;
      pool.proc = null;
      const message = `Scan worker exited unexpectedly (code ${code})`;
      pool.settleAll((job) => ({ ...job.fallback, error: message }));
    });
    return proc;
  };

  pool.run = (payload, fallback) =>
    new Promise((resolve) => {
      const id = nextJob++;
      pool.jobs.set(id, { resolve, fallback });
      pool.ensure().postMessage({ id, ...payload });
    });

  pool.stop = () => {
    if (!pool.proc) return false;
    const proc = pool.proc;
    pool.proc = null;
    proc.kill();
    pool.settleAll(() => ({ cancelled: true }));
    return true;
  };

  return pool;
}

const scanPool = createPool("cinder-scan");

function runScan(kind, cacheDir, fallback) {
  return scanPool.run({ kind, cacheDir }, fallback);
}

function stopWorker() {
  return scanPool.stop();
}

let scanning = null;
ipcMain.handle("usage:collect", () => {
  if (scanning) return scanning;
  const dir = app.getPath("userData");
  scanning = runScan("collect", dir, { entries: [], sources: [] })
    .then((res) => {
      if (res && !res.cancelled && !res.error) writeSnapshot(dir, { usage: res });
      return res;
    })
    .finally(() => {
      scanning = null;
    });
  return scanning;
});

ipcMain.handle("usage:cancel", () => stopWorker());

ipcMain.handle("snapshot:info", () => snapshotInfo(app.getPath("userData")));
ipcMain.handle("snapshot:usage", () => {
  const snap = readSnapshot(app.getPath("userData"));
  return snap && snap.usage ? snap.usage : null;
});
ipcMain.handle("snapshot:calls", () => {
  const snap = readSnapshot(app.getPath("userData"));
  return snap && snap.calls ? snap.calls : null;
});
ipcMain.handle("snapshot:clear", () => clearSnapshot(app.getPath("userData")));

ipcMain.handle("app:open-external", (_e, url) => openExternal(url));

let callsScanning = null;
ipcMain.handle("usage:calls", () => {
  if (callsScanning) return callsScanning;
  const dir = app.getPath("userData");
  callsScanning = runScan("calls", dir, {
    sources: {},
    installed: { skills: [], mcp: {} },
    scannedAt: new Date().toISOString()
  })
    .then((res) => {
      if (res && !res.cancelled && !res.error) writeSnapshot(dir, { calls: res });
      return res;
    })
    .finally(() => {
      callsScanning = null;
    });
  return callsScanning;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") app.setAppUserModelId("app.local.cinder");
    Menu.setApplicationMenu(appMenu());
    loadState();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("will-quit", () => {
    scanPool.stop();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
