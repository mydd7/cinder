const fs = require("fs");

const CHUNK = 4 * 1024 * 1024;

function writeJsonFile(file, value) {
  const tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
  let buf = "";
  const flush = () => {
    if (buf) fs.writeSync(fd, buf);
    buf = "";
  };
  const put = (s) => {
    buf += s;
    if (buf.length >= CHUNK) flush();
  };
  const emit = (v, depth) => {
    if (depth < 3 && Array.isArray(v)) {
      put("[");
      for (let i = 0; i < v.length; i++) {
        if (i) put(",");
        emit(v[i], depth + 1);
      }
      put("]");
      return;
    }
    if (depth < 3 && v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      put("{");
      let first = true;
      for (const k of Object.keys(v)) {
        const item = v[k];
        if (item === undefined || typeof item === "function") continue;
        if (!first) put(",");
        first = false;
        put(JSON.stringify(k) + ":");
        emit(item, depth + 1);
      }
      put("}");
      return;
    }
    const s = JSON.stringify(v);
    put(s === undefined ? "null" : s);
  };
  try {
    emit(value, 0);
    flush();
    fs.closeSync(fd);
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw err;
  }
}

module.exports = { writeJsonFile };
