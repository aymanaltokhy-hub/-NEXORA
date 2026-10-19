import { idbStorage } from './idb'
import { ipcStorage } from './ipc'
import type { Storage } from './types'
import { migrateLegacy } from '../model/migrate'
import { emptyScene, SCHEMA, type Report, type Scene } from '../model/types'
export type { Storage }
export const isDesktop = () => typeof window !== 'undefined' && !!(window as any).api?.sceneLoad
export const createStorage = (): Storage => (isDesktop() ? ipcStorage() : idbStorage())
/** Opens a workspace; first open converts NEXORA 2D data once (stored scene afterwards is the source of truth). */
export async function openWorkspace(st: Storage, id: string): Promise<{ scene: Scene; migrated: Report | null }> {
  const s = await st.loadScene(id)
  if (s) { if (s.schema > SCHEMA) throw new Error('This workspace was saved by a newer version of MADAR.'); return { scene: s, migrated: null } }
  const legacy = await st.legacyObjects(id)
  if (!legacy.length) return { scene: emptyScene(), migrated: null } // nothing to migrate yet: do not persist an empty scene, so later classic data still migrates
  const { scene, report } = migrateLegacy(legacy); await st.saveScene(id, scene); return { scene, migrated: report }
}
