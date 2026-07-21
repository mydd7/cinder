const { DatabaseSync } = require("node:sqlite");

try {
  const db = new DatabaseSync(process.argv[2], { readOnly: true });
  const rows = db.prepare(process.argv[3]).all();
  db.close();
  process.stdout.write(JSON.stringify(rows));
} catch (e) {
  process.stderr.write(String(e && e.message ? e.message : e));
  process.exit(1);
}
