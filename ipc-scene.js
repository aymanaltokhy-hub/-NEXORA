const MIG3 = `CREATE TABLE scenes(workspace_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at INTEGER);`
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
  ipcMain.handle('scene:legacy', (_, id) => q('SELECT data_json FROM objects WHERE workspace_id=?').all(String(id)).map((r) => JSON.parse(r.data_json)))
}
module.exports = { register, MIG3 }
