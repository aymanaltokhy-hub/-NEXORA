import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createVault, unlockVault, encrypt, decrypt } from '../src/vault/crypto'
import { VaultService } from '../src/vault/service'
import { idbStorage } from '../src/storage/idb'
const ITER = 100_000 // minimum accepted by the app; keeps tests fast (production default is 600,000)
describe('unified vault crypto (WebCrypto)', () => {
  it('derives, round-trips and rejects a wrong password', async () => {
    const c = await createVault('correct horse battery', ITER); expect(await unlockVault('correct horse battery', c.meta)).toBeTruthy(); expect(await unlockVault('wrong password!!', c.meta)).toBeNull()
    const blob = await encrypt(c.key, { password: 'S3cret!pw' }, 'id1'); expect(atob(blob)).not.toContain('S3cret'); expect((await decrypt(c.key, blob, 'id1')).password).toBe('S3cret!pw')
  })
  it('detects tampering and entry swapping (AAD), uses fresh nonces', async () => {
    const c = await createVault('correct horse battery', ITER), blob = await encrypt(c.key, { a: 1 }, 'id1'), raw = Uint8Array.from(atob(blob), (x) => x.charCodeAt(0)); raw[raw.length - 1] ^= 1
    await expect(decrypt(c.key, btoa(String.fromCharCode(...raw)), 'id1')).rejects.toBeTruthy(); await expect(decrypt(c.key, blob, 'id2')).rejects.toBeTruthy()
    expect(await encrypt(c.key, { a: 1 }, 'x')).not.toBe(await encrypt(c.key, { a: 1 }, 'x'))
  })
  it('refuses hostile KDF parameters from an imported backup', async () => {
    const c = await createVault('correct horse battery', ITER)
    for (const iter of [10, 2 ** 40]) expect(await unlockVault('correct horse battery', { ...c.meta, kdf: { ...c.meta.kdf, iter } })).toBeNull()
  })
})
describe('vault service on IndexedDB', () => {
  it('setup, save, lock, unlock, plaintext never stored, encrypted backup restores on a fresh profile', async () => {
    const a = idbStorage('v1'), v = new VaultService(a.vault, ITER)
    await expect(v.setup('short')).rejects.toThrow(); await v.setup('a-long-master-pw'); const id = await v.save({ name: 'Gmail', url: 'https://gmail.com', username: 'me', email: '', password: 'PLAINTEXT-MARKER', recovery: '', notes: '', tags: '', created: 1 })
    const raw = JSON.stringify(await a.vault.get()); expect(raw).not.toContain('PLAINTEXT-MARKER'); expect(raw).not.toContain('Gmail')
    v.lock(); await expect(v.list()).rejects.toThrow(/locked/); expect(await v.unlock('wrong-password-x')).toBe(false); expect(await v.unlock('a-long-master-pw')).toBe(true)
    expect((await v.list())[0]).toMatchObject({ id, password: 'PLAINTEXT-MARKER' }); const backup = JSON.parse(JSON.stringify(await v.exportBackup()))
    const b = idbStorage('v2'), v2 = new VaultService(b.vault, ITER); await v2.importBackup(backup); expect(v2.unlocked).toBe(false)
    expect(await v2.unlock('a-long-master-pw')).toBe(true); expect((await v2.list())[0].password).toBe('PLAINTEXT-MARKER')
    await v2.remove(id); expect(await v2.list()).toHaveLength(0)
  })
  it('rejects malformed backups', async () => { const v = new VaultService(idbStorage('v3').vault, ITER); await expect(v.importBackup({ format: 'x' })).rejects.toThrow(/Invalid/) })
})
