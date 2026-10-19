// Vault crypto (no Electron deps so it can be unit-tested). scrypt (memory-hard) derives the key; AES-256-GCM encrypts each entry, bound to its id via AAD.
const crypto = require('crypto')
const KDF = { N: 32768, r: 8, p: 1 }
const derive = (pw, salt, k = KDF) => crypto.scryptSync(pw, salt, 32, { N: k.N, r: k.r, p: k.p, maxmem: 128 * 1024 * 1024 })
function enc(key, obj, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64')
}
function dec(key, b64, aad) {
  const b = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12))
  d.setAAD(Buffer.from(aad)); d.setAuthTag(b.subarray(12, 28))
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'))
}
function create(pw) {
  const salt = crypto.randomBytes(16), key = derive(pw, salt)
  return { key, meta: { salt: salt.toString('base64'), kdf: KDF, verifier: enc(key, { ok: 1 }, 'verifier') } }
}
function unlock(pw, meta) {
  try {
    const k = meta.kdf || KDF
    if (!(k.N >= 16384 && k.N <= 1 << 20 && (k.N & (k.N - 1)) === 0 && k.r === 8 && k.p === 1)) return null
    const key = derive(pw, Buffer.from(meta.salt, 'base64'), k); dec(key, meta.verifier, 'verifier'); return key
  } catch { return null }
}
module.exports = { create, unlock, enc, dec, derive }
