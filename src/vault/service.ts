import { createVault, unlockVault, encrypt, decrypt, type VaultMeta } from './crypto'
export interface VaultStore {
  get(): Promise<{ meta: VaultMeta | null; entries: { id: string; blob: string }[] }>
  setMeta(m: VaultMeta): Promise<void>; putEntry(id: string, blob: string): Promise<void>; delEntry(id: string): Promise<void>
  replace(m: VaultMeta, entries: { id: string; blob: string }[]): Promise<void>
}
export interface Entry { id?: string; name: string; url: string; username: string; email: string; password: string; recovery: string; notes: string; tags: string; created: number; updated?: number }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The key lives only in memory while unlocked. Secrets never touch scene data; scenes only reference entry ids. */
export class VaultService {
  private key: CryptoKey | null = null
  constructor(private st: VaultStore, private iter?: number) {}
  get unlocked() { return !!this.key }
  async exists() { return !!(await this.st.get()).meta }
  async setup(pw: string) {
    if (await this.exists()) throw new Error('Vault already exists'); if (pw.length < 10) throw new Error('Master password must be at least 10 characters')
    const c = await createVault(pw, this.iter); await this.st.setMeta(c.meta); this.key = c.key
  }
  async unlock(pw: string) { const d = await this.st.get(); if (!d.meta) return false; const k = await unlockVault(pw, d.meta); if (!k) { await sleep(700); return false } this.key = k; return true }
  lock() { this.key = null }
  private need() { if (!this.key) throw new Error('Vault is locked'); return this.key }
  async list(): Promise<(Entry & { id: string })[]> {
    const k = this.need(), out: (Entry & { id: string })[] = []
    for (const e of (await this.st.get()).entries) { try { out.push({ ...(await decrypt(k, e.blob, e.id)), id: e.id }) } catch { /* skip unreadable entry */ } }
    return out
  }
  async save(e: Entry) { const k = this.need(), id = e.id || crypto.randomUUID(), { id: _i, ...rest } = e; await this.st.putEntry(id, await encrypt(k, { ...rest, updated: Date.now() }, id)); return id }
  async remove(id: string) { this.need(); await this.st.delEntry(id) }
  async exportBackup() { this.need(); const d = await this.st.get(); return { format: 'madar-vault-backup-v1', meta: d.meta, entries: d.entries } }
  async importBackup(b: any) {
    const ok = b && b.format === 'madar-vault-backup-v1' && b.meta?.format === 'madar-vault-v2' && typeof b.meta.verifier === 'string' && Array.isArray(b.entries) && b.entries.length < 20000 && b.entries.every((e: any) => typeof e?.id === 'string' && e.id.length < 80 && typeof e.blob === 'string' && e.blob.length < 200000)
    if (!ok) throw new Error('Invalid backup file'); await this.st.replace(b.meta as VaultMeta, b.entries); this.lock()
  }
}
