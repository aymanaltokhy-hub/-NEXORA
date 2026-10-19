const { app, BrowserWindow, ipcMain, shell, session, clipboard, dialog, Menu } = require('electron')
const path = require('path'), fs = require('fs'), crypto = require('crypto')
const Database = require('./db')
const extra = require('./ipc-extra')
const scene = require('./ipc-scene')
const logErr = (e) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'crash.log'), `${new Date().toISOString()} ${String((e && e.message) || e).slice(0, 300)}\n`) } catch {} }
// Crash diagnostics: message only (no stacks/user content/vault data). Errors are logged AND shown, never swallowed.
const fail = (e) => { logErr(e); try { dialog.showErrorBox('NEXORA error', String((e && e.message) || e).slice(0, 500)) } catch {} }
process.on('uncaughtException', fail); process.on('unhandledRejection', fail)
app.setPath('userData', path.join(app.getPath('appData'), 'nexora')) // keep existing data location regardless of product name
const gfxFile = path.join(app.getPath('userData'), 'gfx.json')
const gfx = (() => { try { return JSON.parse(fs.readFileSync(gfxFile, 'utf8')) } catch { return { software: false } } })()
const setGfx = (software) => { try { fs.mkdirSync(path.dirname(gfxFile), { recursive: true }); fs.writeFileSync(gfxFile, JSON.stringify({ software })) } catch {} }
const note = (m) => { try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${m}\n`) } catch {} }
note(`start v${app.getVersion()} electron ${process.versions.electron} ${process.platform} ${process.arch} ${require('os').release()}`)
// Hardware rendering by default (needed for 3D). If the GPU process crashes, switch to software mode automatically and restart once.
if (gfx.software) app.disableHardwareAcceleration()
app.on('child-process-gone', (_, d) => { if (d.type === 'GPU' && !gfx.software) { note('GPU process crashed (' + d.reason + ') - switching to software rendering'); setGfx(true); app.relaunch(); app.exit(0) } })
const dev = !app.isPackaged && process.argv.includes('--dev')
let db
const MIG = [`
CREATE TABLE workspaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER);
CREATE TABLE objects(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, type TEXT NOT NULL, z INTEGER, data_json TEXT NOT NULL, updated_at INTEGER);
CREATE INDEX idx_obj_ws ON objects(workspace_id);
CREATE TABLE viewports(workspace_id TEXT PRIMARY KEY, x REAL, y REAL, scale REAL);
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);`]

MIG.push(extra.MIG2); MIG.push(scene.MIG3)

function openDb() {
  const dir = app.getPath('userData')
  db = new Database(path.join(dir, 'nexora.db'))
  db.pragma('journal_mode = WAL')
  for (let v = db.pragma('user_version', { simple: true }); v < MIG.length; v++)
    db.transaction(() => { db.exec(MIG[v]); db.pragma(`user_version = ${v + 1}`) })()
  const bd = path.join(dir, 'backups'); fs.mkdirSync(bd, { recursive: true })
  db.backup(path.join(bd, `nexora-${Date.now()}.db`)).then(() => {
    fs.readdirSync(bd).filter((f) => f.endsWith('.db')).sort().slice(0, -5).forEach((f) => fs.unlinkSync(path.join(bd, f)))
  }).catch(() => {})
}

const httpOnly = (u) => { try { return /^https?:$/.test(new URL(u).protocol) } catch { return false } }
async function grabIcon(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!r.ok) return null
    const ct = (r.headers.get('content-type') || '').split(';')[0]
    const b = Buffer.from(await r.arrayBuffer())
    if (!b.length || b.length > 200000 || !/image|icon|octet/.test(ct)) return null
    return `data:${ct.includes('image') ? ct : 'image/x-icon'};base64,${b.toString('base64')}`
  } catch { return null }
}
async function fetchMeta(url) {
  const out = { title: null, favicon: null }
  if (!httpOnly(url)) return out
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Mozilla/5.0 NEXORA' } })
    const html = (await r.text()).slice(0, 300000)
    out.title = ((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim().replace(/\s+/g, ' ') || null
    const c = []
    for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
      const h = m[0].match(/href=["']([^"']+)["']/i)
      if (h) try { c.push(new URL(h[1], r.url).href) } catch {}
    }
    c.push(new URL('/favicon.ico', r.url).href)
    for (const u of c) { out.favicon = await grabIcon(u); if (out.favicon) break }
  } catch {}
  return out
}

function ipc() {
  const q = (s) => db.prepare(s)
  ipcMain.handle('load', (_, wsId) => {
    if (!q('SELECT COUNT(*) c FROM workspaces').get().c) q('INSERT INTO workspaces VALUES(?,?,?)').run(crypto.randomUUID(), 'Workspace 1', Date.now())
    const workspaces = q('SELECT id,name FROM workspaces ORDER BY created_at').all()
    const last = q("SELECT value FROM meta WHERE key='last_ws'").get()?.value
    const id = [wsId, last].find((x) => x && workspaces.some((w) => w.id === x)) || workspaces[0].id
    q("INSERT OR REPLACE INTO meta VALUES('last_ws',?)").run(id)
    return {
      workspaces, wsId: id,
      objects: q('SELECT data_json FROM objects WHERE workspace_id=?').all(id).map((r) => JSON.parse(r.data_json)),
      viewport: q('SELECT x,y,scale FROM viewports WHERE workspace_id=?').get(id) || null
    }
  })
  const save = db.transaction((ws, list) => {
    q('DELETE FROM objects WHERE workspace_id=?').run(ws)
    const ins = q('INSERT INTO objects VALUES(?,?,?,?,?,?)')
    for (const o of list) ins.run(String(o.id), ws, String(o.type), o.z | 0, JSON.stringify(o), Date.now())
  })
  ipcMain.handle('saveObjects', (_, ws, list) => { save(ws, list); return true })
  ipcMain.handle('saveViewport', (_, ws, v) => { q('INSERT OR REPLACE INTO viewports VALUES(?,?,?,?)').run(ws, v.x, v.y, v.scale); return true })
  ipcMain.handle('createWs', (_, name) => { const id = crypto.randomUUID(); q('INSERT INTO workspaces VALUES(?,?,?)').run(id, String(name).slice(0, 80), Date.now()); return id })
  ipcMain.handle('renameWs', (_, id, name) => { q('UPDATE workspaces SET name=? WHERE id=?').run(String(name).slice(0, 80), id); return true })
  ipcMain.handle('deleteWs', (_, id) => {
    if (q('SELECT COUNT(*) c FROM workspaces').get().c < 2) return false
    db.transaction(() => { for (const t of ['workspaces WHERE id', 'objects WHERE workspace_id', 'viewports WHERE workspace_id', 'scenes WHERE workspace_id']) q(`DELETE FROM ${t}=?`).run(id) })()
    return true
  })
  ipcMain.handle('meta', (_, url) => fetchMeta(String(url)))
  ipcMain.handle('open', (_, url) => (httpOnly(url) ? shell.openExternal(url) : false))
}

const DEV_URL = 'http://127.0.0.1:5173'
if (!app.requestSingleInstanceLock()) { note('another instance is already running - exiting'); app.quit() }
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus() } })

app.whenReady().then(() => {
  try {
    openDb(); ipc(); extra.register({ db, ipcMain, clipboard, dialog, BrowserWindow }); scene.register({ db, ipcMain, crypto }); gfxIpc()
    Menu.setApplicationMenu(null)
    if (!dev) session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: { ...d.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'"] } }))
    const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, show: false, backgroundColor: '#101318', title: 'MADAR',
      icon: path.join(__dirname, 'build', 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
    const show = () => { note('window shown'); if (!win.isDestroyed() && !win.isVisible()) win.show() }
    win.once('ready-to-show', show); setTimeout(show, 4000)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e, u) => { if (!u.startsWith(DEV_URL) && !u.startsWith('file:')) e.preventDefault() })
    win.webContents.on('did-fail-load', (_, code, desc, url) => { if (code !== -3) fail(new Error(`Could not load the interface (${desc}) ${url}`)) })
    win.webContents.on('render-process-gone', (_, d) => fail(new Error('Interface crashed: ' + d.reason)))
    win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools() })
    win.webContents.on('did-finish-load', () => note('interface loaded'))
    note('creating window')
    dev ? win.loadURL(DEV_URL) : win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  } catch (e) { fail(e); app.quit() }
})
app.on('window-all-closed', () => app.quit())

function gfxIpc() {
  ipcMain.handle('gfx:info', async () => ({ software: !!gfx.software, status: app.getGPUFeatureStatus(), info: await app.getGPUInfo('basic').catch(() => null) }))
  ipcMain.handle('gfx:set', (_, v) => { setGfx(!!v); app.relaunch(); app.exit(0) })
}
