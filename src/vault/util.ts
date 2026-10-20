const POOLS: Record<string, string> = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', sym: '!@#$%^&*()-_=+[]{};:,.?' }
export const POOL_KEYS = Object.keys(POOLS)
export function genPw(len: number, sets: string[]) {
  const pool = sets.map((k) => POOLS[k]).join('') || POOLS.lower, max = Math.floor(0x100000000 / pool.length) * pool.length; let out = ''
  while (out.length < len) { const a = new Uint32Array(len); crypto.getRandomValues(a); for (const v of a) if (v < max && out.length < len) out += pool[v % pool.length] }
  return out
}
export function strength(pw: string) {
  const pool = (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/\d/.test(pw) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(pw) ? 28 : 0), bits = pw.length * Math.log2(Math.max(pool, 1))
  return { bits: Math.round(bits), label: bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'good' : 'strong' }
}
/** Copies a secret and clears the clipboard afterwards (only if it still holds that secret, when the browser lets us check). */
export async function copySecret(text: string, secs = 20) {
  await navigator.clipboard.writeText(text)
  setTimeout(async () => { try { if ((await navigator.clipboard.readText()) !== text) return } catch { /* cannot verify: clear anyway */ } try { await navigator.clipboard.writeText('') } catch {} }, secs * 1000)
}
