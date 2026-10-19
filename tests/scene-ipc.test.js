import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import Database from '../db.js'
import scene from '../ipc-scene.js'
import { ipcStorage } from '../src/storage/ipc'
import { openWorkspace } from '../src/storage'
import { makeLegacyDemo } from '../src/model/demo'
// Desktop path end-to-end against a real SQLite DB: legacy NEXORA rows -> migration -> stored scene -> reload.
describe('desktop scene storage over IPC', () => {
  const db = new Database(':memory:'), h = {}
  db.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at INTEGER);CREATE TABLE objects(id TEXT PRIMARY KEY,workspace_id TEXT,type TEXT,z INTEGER,data_json TEXT,updated_at INTEGER);CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);` + scene.MIG3)
  scene.register({ db, ipcMain: { handle: (n, f) => (h[n] = f) }, crypto })
  globalThis.window = { api: { wsList: () => h['ws:list']({}), wsLast: (i) => h['ws:last']({}, i), createWs: () => 'x', renameWs: () => 1, deleteWs: () => 1,
    sceneLoad: (i) => h['scene:load']({}, i), sceneSave: (i, s) => h['scene:save']({}, i, s), sceneLegacy: (i) => h['scene:legacy']({}, i) } }
  it('migrates real stored NEXORA objects once, then loads the saved scene', async () => {
    const st = ipcStorage(), ws = (await st.listWorkspaces()).workspaces[0], ins = db.prepare('INSERT INTO objects VALUES(?,?,?,?,?,?)')
    for (const o of makeLegacyDemo(120, 4)) ins.run(o.id, ws.id, o.type, o.z, JSON.stringify(o), 1)
    const a = await openWorkspace(st, ws.id); expect(a.migrated?.bodies).toBe(120)
    db.prepare('DELETE FROM objects').run() // proves the second open reads the stored scene, not legacy rows
    const b = await openWorkspace(st, ws.id); expect(b.migrated).toBeNull(); expect(b.scene).toEqual(a.scene)
  })
  it('rejects malformed scenes', async () => { expect(() => window.api.sceneSave('w', { bad: 1 })).toThrow(/Invalid scene/) })
})
