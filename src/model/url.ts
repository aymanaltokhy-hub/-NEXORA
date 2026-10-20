export function normUrl(raw: string): string | null {
  let u = raw.trim(); if (!u) return null
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try { const x = new URL(u); return x.hostname.includes('.') || x.hostname === 'localhost' ? x.href : null } catch { return null }
}
export const hostOf = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, '') } catch { return '' } }
