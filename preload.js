const { contextBridge, ipcRenderer } = require('electron')
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a)
const names = { load: 'load', saveObjects: 'saveObjects', saveViewport: 'saveViewport', createWs: 'createWs', renameWs: 'renameWs', deleteWs: 'deleteWs', meta: 'meta', open: 'open',
  search: 'search', exportWs: 'exportWs', savePng: 'savePng', vaultStatus: 'vault:status', vaultSetup: 'vault:setup', vaultUnlock: 'vault:unlock', vaultLock: 'vault:lock',
  vaultList: 'vault:list', vaultSave: 'vault:save', vaultDelete: 'vault:delete', vaultCopy: 'vault:copy', vaultAutolock: 'vault:autolock', vaultExport: 'vault:export', vaultImport: 'vault:import',
  wsList: 'ws:list', wsLast: 'ws:last', sceneLoad: 'scene:load', sceneSave: 'scene:save', sceneLegacy: 'scene:legacy', gfxInfo: 'gfx:info', vault2Get: 'vault2:get', vault2SetMeta: 'vault2:setmeta', vault2Put: 'vault2:put', vault2Del: 'vault2:del', vault2Replace: 'vault2:replace', gfxSet: 'gfx:set' }
const api = Object.fromEntries(Object.entries(names).map(([k, c]) => [k, inv(c)]))
api.onLocked = (cb) => { ipcRenderer.removeAllListeners('vault:locked'); ipcRenderer.on('vault:locked', () => cb()) }
contextBridge.exposeInMainWorld('api', api)
