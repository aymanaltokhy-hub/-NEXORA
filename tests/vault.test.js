import { describe, it, expect } from 'vitest'
import V from '../vault.js'
describe('vault crypto', () => {
  const c = V.create('correct horse battery')
  it('unlocks with the right password only', () => {
    expect(V.unlock('correct horse battery', c.meta)).toBeTruthy()
    expect(V.unlock('wrong password!!', c.meta)).toBeNull()
  })
  it('round-trips and never stores plaintext', () => {
    const blob = V.enc(c.key, { password: 'S3cret!pw' }, 'id1')
    expect(Buffer.from(blob, 'base64').toString('latin1')).not.toContain('S3cret')
    expect(V.dec(c.key, blob, 'id1').password).toBe('S3cret!pw')
  })
  it('rejects tampering and entry swapping (AAD)', () => {
    const blob = V.enc(c.key, { a: 1 }, 'id1'), b = Buffer.from(blob, 'base64'); b[b.length - 1] ^= 1
    expect(() => V.dec(c.key, b.toString('base64'), 'id1')).toThrow()
    expect(() => V.dec(c.key, blob, 'id2')).toThrow()
  })
  it('uses a fresh nonce each time', () => { expect(V.enc(c.key, { a: 1 }, 'x')).not.toBe(V.enc(c.key, { a: 1 }, 'x')) })
  it('refuses hostile KDF params from an imported backup', () => {
    expect(V.unlock('correct horse battery', { ...c.meta, kdf: { N: 2 ** 30, r: 8, p: 1 } })).toBeNull()
  })
})
