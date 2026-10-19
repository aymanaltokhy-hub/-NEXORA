const crypto = require('crypto'), fs = require('fs'), V = require('./vault')
const MIG2 = `
CREATE TABLE vault_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE vault_entries(id TEXT PRIMARY KEY, blob TEXT NOT NULL, updated_at INTEGER);`

function register({ db, ipcMain, clipboard, dialog, BrowserWindow }) {
  let key = null, timer = null, mins = 5
  const q = (s) => db.prepare(s), win = () => BrowserWindow.getAllWindows()[0]
  const lock = () => { key = null; clearTimeout(timer); win()?.webContents.send('vault:locked') }
  const touch = () => { clearTimeout(timer); if (key) timer = setTimeout(lock, mins * 60000) }
  const meta = () => { const r = q("SELECT value FROM vault_meta WHERE key='meta'").get(); return r ? JSON.parse(r.value) : null }
  const need = () => { if (!key) throw new Error('Vault is locked'); touch() }

  ipcMain.handle('vault:status', () => ({ exists: !!meta(), unlocked: !!key }))
  ipcMain.handle('vault:setup', (_, pw) => {
    if (meta() || typeof pw !== 'string' || pw.length < 10) return false
    const c = V.create(pw); q("INSERT INTO vault_meta VALUES('meta',?)").run(JSON.stringify(c.meta)); key = c.key; touch(); return true
  })
  ipcMain.handle('vault:unlock', async (_, pw) => {
    const m = meta(), k = m && typeof pw === 'string' ? V.unlock(pw, m) : null
    if (!k) { await new Promise((r) => setTimeout(r, 700)); return false }
    key = k; touch(); return true
  })
  ipcMain.handle('vault:lock', () => { lock(); return true })
  ipcMain.handle('vault:autolock', (_, m) => { mins = Math.min(120, Math.max(1, +m || 5)); touch(); return true })
  ipcMain.handle('vault:list', () => { need(); return q('SELECT id,blob FROM vault_entries').all().flatMap((r) => { try { return [{ ...V.dec(key, r.blob, r.id), id: r.id }] } catch { return [] } }) })
  ipcMain.handle('vault:save', (_, e) => {
    need(); const id = typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(), { id: _x, ...rest } = e
    rest.updated = Date.now(); q('INSERT OR REPLACE INTO vault_entries VALUES(?,?,?)').run(id, V.enc(key, rest, id), rest.updated); return id
  })
  ipcMain.handle('vault:delete', (_, id) => { need(); q('DELETE FROM vault_entries WHERE id=?').run(String(id)); return true })
  ipcMain.handle('vault:copy', (_, t, secs = 20) => {
    need(); const v = String(t); clipboard.writeText(v)
    setTimeout(() => { if (clipboard.readText() === v) clipboard.clear() }, Math.max(5, +secs || 20) * 1000); return true
  })
  ipcMain.handle('vault:export', async () => {
    need()
    const r = await dialog.showSaveDialog(win(), { defaultPath: 'nexora-vault-backup.json', filters: [{ name: 'NEXORA encrypted vault', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return false
    fs.writeFileSync(r.filePath, JSON.stringify({ format: 'nexora-vault-v1', meta: meta(), entries: q('SELECT id,blob FROM vault_entries').all() })); return true
  })
  ipcMain.handle('vault:import', async () => {
    const r = await dialog.showOpenDialog(win(), { filters: [{ name: 'NEXORA encrypted vault', extensions: ['json'] }], properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return false
    let b; try { b = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')) } catch { dialog.showErrorBox('NEXORA', 'Not a valid backup file.'); return false }
    const ok = b && b.format === 'nexora-vault-v1' && b.meta && typeof b.meta.salt === 'string' && typeof b.meta.verifier === 'string' && Array.isArray(b.entries) && b.entries.every((e) => typeof e.id === 'string' && typeof e.blob === 'string')
    if (!ok) { dialog.showErrorBox('NEXORA', 'Not a valid backup file.'); return false }
    const c = await dialog.showMessageBox(win(), { type: 'warning', buttons: ['Cancel', 'Replace vault'], defaultId: 0, cancelId: 0, message: 'Replace the current vault with this backup?', detail: 'Existing vault entries will be overwritten. You will need the backup\'s master password.' })
    if (c.response !== 1) return false
    db.transaction(() => {
      q('DELETE FROM vault_entries').run(); q('DELETE FROM vault_meta').run(); q("INSERT INTO vault_meta VALUES('meta',?)").run(JSON.stringify(b.meta))
      const ins = q('INSERT INTO vault_entries VALUES(?,?,?)'); for (const e of b.entries) ins.run(e.id, e.blob, Date.now())
    })(); lock(); return true
  })

  ipcMain.handle('search', (_, qs) => {
    const s = String(qs || '').toLowerCase().trim(), out = []
    const rows = q('SELECT o.workspace_id w, w.name wn, o.data_json d FROM objects o JOIN workspaces w ON w.id=o.workspace_id').all()
    for (const r of rows) {
      const o = JSON.parse(r.d); if (o.type === 'stroke') continue
      const hay = [o.title, o.url, o.text, o.notes, ...(o.tags || [])].join(' ').toLowerCase()
      const ok = !s || s === 'fav' ? !!o.fav : s[0] === '#' ? (o.tags || []).some((t) => t.toLowerCase().includes(s.slice(1))) : hay.includes(s) || r.wn.toLowerCase().includes(s)
      if (ok) out.push({ ws: r.w, wsName: r.wn, id: o.id, type: o.type, label: o.title || o.text || o.url || '', fav: !!o.fav })
      if (out.length >= 40) break
    }
    return out
  })
  ipcMain.handle('exportWs', async (_, id) => {
    const w = q('SELECT name FROM workspaces WHERE id=?').get(id); if (!w) return false
    const r = await dialog.showSaveDialog(win(), { defaultPath: `${w.name.replace(/[^\w-]+/g, '_')}.nexora.json`, filters: [{ name: 'NEXORA workspace', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return false
    fs.writeFileSync(r.filePath, JSON.stringify({ format: 'nexora-workspace-v1', name: w.name, viewport: q('SELECT x,y,scale FROM viewports WHERE workspace_id=?').get(id) || null,
      objects: q('SELECT data_json FROM objects WHERE workspace_id=?').all(id).map((x) => JSON.parse(x.data_json)) }, null, 1)); return true
  })
  ipcMain.handle('savePng', async (_, url) => {
    if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) return false
    const r = await dialog.showSaveDialog(win(), { defaultPath: 'nexora-view.png', filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (r.canceled || !r.filePath) return false
    fs.writeFileSync(r.filePath, Buffer.from(url.split(',')[1], 'base64')); return true
  })
}
module.exports = { register, MIG2 }
