import type { Obj } from '../classic/types'
import type { Scene } from '../model/types'
export interface WsInfo { id: string; name: string }
/** One interface, two backends: SQLite over IPC (desktop) and IndexedDB (web/PWA). Everything above this layer is shared. */
export interface Storage {
  kind: 'ipc' | 'idb'
  listWorkspaces(): Promise<{ workspaces: WsInfo[]; last: string | null }>
  createWorkspace(name: string): Promise<string>
  renameWorkspace(id: string, name: string): Promise<void>
  deleteWorkspace(id: string): Promise<boolean>
  setLast(id: string): Promise<void>
  loadScene(id: string): Promise<Scene | null>
  saveScene(id: string, scene: Scene): Promise<void>
  legacyObjects(id: string): Promise<Obj[]>
}
