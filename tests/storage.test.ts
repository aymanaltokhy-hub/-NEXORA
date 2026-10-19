import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { idbStorage } from '../src/storage/idb'
import { openWorkspace } from '../src/storage'
import { migrateLegacy } from '../src/model/migrate'
import { makeLegacyDemo } from '../src/model/demo'
describe('IndexedDB storage (web)', () => {
  it('creates a default workspace, round-trips a scene and remembers the last workspace', async () => {
    const st = idbStorage('t1'), l = await st.listWorkspaces(); expect(l.workspaces).toHaveLength(1)
    const { scene } = migrateLegacy(makeLegacyDemo(40, 3), 5); await st.saveScene(l.workspaces[0].id, scene)
    expect(await st.loadScene(l.workspaces[0].id)).toEqual(scene)
    await st.setLast(l.workspaces[0].id); expect((await st.listWorkspaces()).last).toBe(l.workspaces[0].id)
  })
  it('opens an empty workspace without migration and refuses to delete the last one', async () => {
    const st = idbStorage('t2'), id = (await st.listWorkspaces()).workspaces[0].id, r = await openWorkspace(st, id)
    expect(r.scene.bodies).toHaveLength(0); expect(r.migrated).toBeNull(); expect(await st.deleteWorkspace(id)).toBe(false)
  })
  it('rejects scenes written by a newer schema', async () => {
    const st = idbStorage('t3'), id = (await st.listWorkspaces()).workspaces[0].id; await st.saveScene(id, { schema: 99, systems: [], bodies: [], settings: {} as any })
    await expect(openWorkspace(st, id)).rejects.toThrow(/newer/)
  })
})
