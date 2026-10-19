import type { Obj } from './types'
export function pip(pts: number[], x: number, y: number) {
  let c = false
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export function norm(abs: number[]) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
  for (let i = 0; i < abs.length; i += 2) { x0 = Math.min(x0, abs[i]); x1 = Math.max(x1, abs[i]); y0 = Math.min(y0, abs[i + 1]); y1 = Math.max(y1, abs[i + 1]) }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), points: abs.map((v, i) => v - (i % 2 ? y0 : x0)) }
}
export function inside(z: Obj, l: Obj) {
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2
  if (z.shape === 'poly') return pip(z.points || [], cx - z.x, cy - z.y)
  if (z.shape === 'ellipse') return ((cx - z.x - z.w / 2) / (z.w / 2)) ** 2 + ((cy - z.y - z.h / 2) / (z.h / 2)) ** 2 <= 1
  return cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h
}
export const textH = (o: Obj) => Math.ceil((o.fontSize || 20) * 1.35 * (o.text || '').split('\n').length) + 12
export function rgba(hex: string | undefined, a: number) {
  const h = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex! : '#6C8CFF'
  return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`
}
