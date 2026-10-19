// Thin adapter over Node's built-in node:sqlite (no native build step). Mimics the small subset of better-sqlite3 the app uses.
const { DatabaseSync } = require('node:sqlite')
function open(file) {
  const db = new DatabaseSync(file)
  return {
    exec: (s) => db.exec(s),
    prepare: (s) => db.prepare(s),
    pragma(s, opt) {
      if (s.includes('=')) { db.exec('PRAGMA ' + s); return }
      const row = db.prepare('PRAGMA ' + s).get(); return opt && opt.simple ? Object.values(row)[0] : row
    },
    transaction: (fn) => (...a) => {
      db.exec('BEGIN')
      try { const r = fn(...a); db.exec('COMMIT'); return r } catch (e) { try { db.exec('ROLLBACK') } catch {} throw e }
    },
    backup: (dest) => new Promise((res, rej) => { try { db.exec(`VACUUM INTO '${String(dest).replace(/'/g, "''")}'`); res() } catch (e) { rej(e) } })
  }
}
module.exports = open
