const { collect } = require("./collect");
const { collectCalls } = require("./calls");
const { readTranscript } = require("./transcript");

function post(msg) {
  process.parentPort.postMessage(msg);
}

process.parentPort.on("message", (e) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object") return;
  const { id, kind, cacheDir, source, session } = msg;
  const job =
    kind === "calls"
      ? collectCalls(cacheDir)
      : kind === "transcript"
        ? readTranscript(source, session)
        : collect(cacheDir, (progress) => post({ type: "progress", id, progress }));
  job.then(
    (result) => post({ type: "done", id, result }),
    (err) => post({ type: "error", id, message: String(err && err.message ? err.message : err) })
  );
});
