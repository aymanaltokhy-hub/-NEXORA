import { describe, it, expect } from 'vitest'
import Database from '../db.js'
import extra from '../ipc-extra.js'
// Integration test of vault + search IPC handlers against a real SQLite DB with a fake ipcMain.
const setup = () => {
  const db = new Database(':memory:'), h = {}
  db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,created_at INTEGER);CREATE TABLE objects(id TEXT PRIMARY KEY,workspace_id TEXT,type TEXT,z INTEGER,data_json TEXT,updated_at INTEGER);` + extra.MIG2)
  db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('w1', 'Work', 1)
  db.prepare('INSERT INTO objects VALUES(?,?,?,?,?,?)').run('o1', 'w1', 'link', 1, JSON.stringify({ id: 'o1', type: 'link', title: 'GitHub', url: 'https://github.com', tags: ['dev'], fav: true }), 1)
  const clip = { t: '', writeText(x) { this.t = x }, readText() { return this.t }, clear() { this.t = '' } }
  extra.register({ db, ipcMain: { handle: (n, f) => (h[n] = f) }, clipboard: clip, dialog: {}, BrowserWindow: { getAllWindows: () => [] } })
  return { db, h, call: (n, ...a) => h[n]({}, ...a) }
}
describe('vault + search IPC', () => {
  it('stores only ciphertext, locks, and requires the right password', async () => {
    const { db, call } = setup()
    expect(await call('vault:setup', 'short')).toBe(false)
    expect(await call('vault:setup', 'a-long-master-pw')).toBe(true)
    const id = await call('vault:save', { name: 'Gmail', password: 'PLAINTEXT-MARKER-123' })
    const raw = JSON.stringify(db.prepare('SELECT * FROM vault_entries').all()) + JSON.stringify(db.prepare('SELECT * FROM vault_meta').all())
    expect(raw).not.toContain('PLAINTEXT-MARKER'); expect(raw).not.toContain('Gmail')
    expect((await call('vault:list'))[0].password).toBe('PLAINTEXT-MARKER-123')
    await call('vault:lock'); expect(() => call('vault:list')).toThrow()
    expect(await call('vault:unlock', 'wrong-password-x')).toBe(false)
    expect(await call('vault:unlock', 'a-long-master-pw')).toBe(true)
    expect((await call('vault:list'))[0].id).toBe(id)
  })
  it('search finds by text, #tag and fav', async () => {
    const { call } = setup()
    expect((await call('search', 'git'))).toHaveLength(1); expect(await call('search', '#dev')).toHaveLength(1)
    expect(await call('search', 'fav')).toHaveLength(1); expect(await call('search', 'nomatch')).toHaveLength(0)
  })
})
