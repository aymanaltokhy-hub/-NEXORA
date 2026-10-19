import type { Storage } from './types'
export const ipcStorage = (): Storage => {
  const a = window.api
  return { kind: 'ipc', listWorkspaces: () => a.wsList(), createWorkspace: (n) => a.createWs(n), renameWorkspace: async (i, n) => { await a.renameWs(i, n) },
    deleteWorkspace: (i) => a.deleteWs(i), setLast: async (i) => { await a.wsLast(i) }, loadScene: (i) => a.sceneLoad(i), saveScene: async (i, s) => { await a.sceneSave(i, s) }, legacyObjects: (i) => a.sceneLegacy(i) }
}
