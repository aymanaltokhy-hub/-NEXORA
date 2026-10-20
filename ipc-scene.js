const MIG3 = `CREATE TABLE scenes(workspace_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at INTEGER);`
const MIG4 = `CREATE TABLE vault2_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE vault2_entries(id TEXT PRIMARY KEY, blob TEXT NOT NULL, updated_at INTEGER);`
const MAX = 25 * 1024 * 1024
function register({ db, ipcMain, crypto }) {
  const q = (s) => db.prepare(s)
  ipcMain.handle('ws:list', () => {
    if (!q('SELECT COUNT(*) c FROM workspaces').get().c) q('INSERT INTO workspaces VALUES(?,?,?)').run(crypto.randomUUID(), 'Workspace 1', Date.now())
    const workspaces = q('SELECT id,name FROM workspaces ORDER BY created_at').all()
    const last = q("SELECT value FROM meta WHERE key='last_ws'").get()?.value || null
    return { workspaces, last: workspaces.some((w) => w.id === last) ? last : null }
  })
  ipcMain.handle('ws:last', (_, id) => { q("INSERT OR REPLACE INTO meta VALUES('last_ws',?)").run(String(id)); return true })
  ipcMain.handle('scene:load', (_, id) => { const r = q('SELECT data_json FROM scenes WHERE workspace_id=?').get(String(id)); return r ? JSON.parse(r.data_json) : null })
  ipcMain.handle('scene:save', (_, id, scene) => {
    if (!scene || typeof scene.schema !== 'number' || !Array.isArray(scene.systems) || !Array.isArray(scene.bodies)) throw new Error('Invalid scene')
    const json = JSON.stringify(scene); if (json.length > MAX) throw new Error('Scene too large')
    q('INSERT OR REPLACE INTO scenes VALUES(?,?,?)').run(String(id), json, Date.now()); return true
  })
  // Unified (WebCrypto) vault: the main process only stores opaque ciphertext; keys never reach it.
  const okMeta = (m) => m && m.format === 'madar-vault-v2' && typeof m.verifier === 'string' && m.kdf && typeof m.kdf.salt === 'string'
  const okEntries = (e) => Array.isArray(e) && e.length < 20000 && e.every((x) => x && typeof x.id === 'string' && x.id.length < 80 && typeof x.blob === 'string' && x.blob.length < 200000)
  ipcMain.handle('vault2:get', () => { const m = q("SELECT value FROM vault2_meta WHERE key='meta'").get(); return { meta: m ? JSON.parse(m.value) : null, entries: q('SELECT id,blob FROM vault2_entries').all() } })
  ipcMain.handle('vault2:setmeta', (_, m) => { if (!okMeta(m)) throw new Error('Invalid vault metadata'); q("INSERT OR REPLACE INTO vault2_meta VALUES('meta',?)").run(JSON.stringify(m)); return true })
  ipcMain.handle('vault2:put', (_, id, blob) => { if (typeof id !== 'string' || id.length > 80 || typeof blob !== 'string' || blob.length > 200000) throw new Error('Invalid entry'); q('INSERT OR REPLACE INTO vault2_entries VALUES(?,?,?)').run(id, blob, Date.now()); return true })
  ipcMain.handle('vault2:del', (_, id) => { q('DELETE FROM vault2_entries WHERE id=?').run(String(id)); return true })
  ipcMain.handle('vault2:replace', (_, m, entries) => {
    if (!okMeta(m) || !okEntries(entries)) throw new Error('Invalid backup')
    db.transaction(() => { q('DELETE FROM vault2_entries').run(); q("INSERT OR REPLACE INTO vault2_meta VALUES('meta',?)").run(JSON.stringify(m)); const ins = q('INSERT INTO vault2_entries VALUES(?,?,?)'); for (const e of entries) ins.run(e.id, e.blob, Date.now()) })(); return true
  })
  ipcMain.handle('scene:legacy', (_, id) => q('SELECT data_json FROM objects WHERE workspace_id=?').all(String(id)).map((r) => JSON.parse(r.data_json)))
}
module.exports = { register, MIG3, MIG4 }
