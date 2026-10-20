// Local-only image storage (IndexedDB) for custom backgrounds. Never leaves the device.
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('madar-blobs', 1); r.onupgradeneeded = () => r.result.createObjectStore('b'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const run = async <T,>(m: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const d = await open(); return new Promise<T>((res, rej) => { const r = f(d.transaction('b', m).objectStore('b')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
export const putBlob = (k: string, b: Blob) => run('readwrite', (s) => s.put(b, k))
export const getBlob = (k: string) => run<Blob | undefined>('readonly', (s) => s.get(k))
export const delBlob = (k: string) => run('readwrite', (s) => s.delete(k))
export const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/webp'], MAX_IMG = 5 * 1024 * 1024
export async function validateImage(f: File) {
  if (!ALLOWED_IMG.includes(f.type) || f.size > MAX_IMG) return false
  try { const b = await createImageBitmap(f); const ok = b.width > 0 && b.width <= 8192 && b.height <= 8192; b.close(); return ok } catch { return false }
}
