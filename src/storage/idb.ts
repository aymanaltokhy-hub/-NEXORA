import type { Storage, WsInfo } from './types'
const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
export function idbStorage(name = 'madar'): Storage {
  const open = () => new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(name, 2)
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('workspaces')) d.createObjectStore('workspaces', { keyPath: 'id' }); for (const n of ['scenes', 'meta', 'vmeta', 'ventries']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n) }
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  let dbp: Promise<IDBDatabase> | null = null
  const db = () => (dbp ||= open())
  const store = async (s: string, m: IDBTransactionMode = 'readonly') => (await db()).transaction(s, m).objectStore(s)
  const uid = () => crypto.randomUUID()
  return {
    kind: 'idb',
    async listWorkspaces() {
      let ws = (await req((await store('workspaces')).getAll())) as (WsInfo & { created: number })[]
      if (!ws.length) { const w = { id: uid(), name: 'Workspace 1', created: Date.now() }; await req((await store('workspaces', 'readwrite')).put(w)); ws = [w] }
      ws.sort((a, b) => a.created - b.created)
      const last = (await req((await store('meta')).get('last'))) as string | undefined
      return { workspaces: ws.map(({ id, name }) => ({ id, name })), last: last && ws.some((w) => w.id === last) ? last : null }
    },
    async createWorkspace(n) { const id = uid(); await req((await store('workspaces', 'readwrite')).put({ id, name: n.slice(0, 80), created: Date.now() })); return id },
    async renameWorkspace(id, n) { const s = await store('workspaces', 'readwrite'); const w: any = await req(s.get(id)); if (w) await req(s.put({ ...w, name: n.slice(0, 80) })) },
    async deleteWorkspace(id) {
      if ((await req((await store('workspaces')).count())) < 2) return false
      await req((await store('workspaces', 'readwrite')).delete(id)); await req((await store('scenes', 'readwrite')).delete(id)); return true
    },
    async setLast(id) { await req((await store('meta', 'readwrite')).put(id, 'last')) },
    async loadScene(id) { return ((await req((await store('scenes')).get(id))) as any) ?? null },
    async saveScene(id, scene) { await req((await store('scenes', 'readwrite')).put(JSON.parse(JSON.stringify(scene)), id)) },
    async legacyObjects() { return [] }, // the web build has no NEXORA 2D history
    vault: {
      async get() {
        const meta = ((await req((await store('vmeta')).get('meta'))) as any) ?? null, s = await store('ventries'), keys = (await req(s.getAllKeys())) as string[], vals = (await req(s.getAll())) as string[]
        return { meta, entries: keys.map((id, i) => ({ id, blob: vals[i] })) }
      },
      async setMeta(m) { await req((await store('vmeta', 'readwrite')).put(m, 'meta')) },
      async putEntry(id, blob) { await req((await store('ventries', 'readwrite')).put(blob, id)) },
      async delEntry(id) { await req((await store('ventries', 'readwrite')).delete(id)) },
      async replace(m, entries) {
        const d = await db(), tx = d.transaction(['vmeta', 'ventries'], 'readwrite'); tx.objectStore('vmeta').put(m, 'meta'); const es = tx.objectStore('ventries'); es.clear(); entries.forEach((e) => es.put(e.blob, e.id))
        await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
      }
    }
  }
}
