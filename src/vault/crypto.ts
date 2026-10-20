// Unified vault crypto (WebCrypto): identical on desktop, phone, tablet and PC. PBKDF2-SHA256 -> AES-256-GCM, every entry bound to its id via AAD.
const enc = new TextEncoder(), dec = new TextDecoder()
export const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
export const KDF = { name: 'PBKDF2', hash: 'SHA-256', iter: 600_000 }
export interface VaultMeta { format: 'madar-vault-v2'; kdf: { name: string; hash: string; iter: number; salt: string }; verifier: string }
async function derive(pw: string, salt: Uint8Array, iter: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function encrypt(key: CryptoKey, obj: unknown, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(JSON.stringify(obj))))
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64(out)
}
export async function decrypt(key: CryptoKey, blob: string, aad: string) {
  const u = unb64(blob); return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12), additionalData: enc.encode(aad) }, key, u.slice(12))))
}
export async function createVault(pw: string, iter = KDF.iter) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pw, salt, iter)
  return { key, meta: { format: 'madar-vault-v2', kdf: { name: KDF.name, hash: KDF.hash, iter, salt: b64(salt) }, verifier: await encrypt(key, { ok: 1 }, 'verifier') } as VaultMeta }
}
/** Returns the key, or null for a wrong password / invalid or hostile parameters (iteration count is bounded so a crafted backup cannot freeze the app). */
export async function unlockVault(pw: string, meta: VaultMeta) {
  try {
    const k = meta?.kdf; if (meta.format !== 'madar-vault-v2' || k.name !== 'PBKDF2' || k.hash !== 'SHA-256' || !(k.iter >= 100_000 && k.iter <= 5_000_000) || typeof k.salt !== 'string' || k.salt.length > 64) return null
    const key = await derive(pw, unb64(k.salt), k.iter); await decrypt(key, meta.verifier, 'verifier'); return key
  } catch { return null }
}
