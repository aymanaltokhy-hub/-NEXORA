import type { Obj } from '../classic/types'
import { inside } from '../classic/geom'
import { assignOrbits, separate } from './orbit'
import { Body, Report, Scene, System, emptyScene, SCHEMA } from './types'
const K = 1 / 30 // legacy pixels -> world units
const hostOf = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, '') } catch { return '' } }
const hashColor = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 60% 60%)` }
function area(z: Obj) {
  if (z.shape === 'ellipse') return (Math.PI * z.w * z.h) / 4
  if (z.shape === 'poly' && z.points && z.points.length >= 6) { let a = 0; const p = z.points; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1]; return Math.abs(a) / 2 }
  return z.w * z.h
}
/** Converts NEXORA 2D objects into a MADAR scene. Zones -> systems; links -> orbiting bodies; nothing is dropped silently. */
export function migrateLegacy(objs: Obj[], now = Date.now()): { scene: Scene; report: Report } {
  const zones = objs.filter((o) => o.type === 'zone').sort((a, b) => a.z - b.z || a.id.localeCompare(b.id))
  const links = objs.filter((o) => o.type === 'link').sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const members = new Map<string, Obj[]>(zones.map((z) => [z.id, []])), orphans: Obj[] = []
  for (const l of links) {
    const cand = zones.filter((z) => inside(z, l)).sort((a, b) => area(a) - area(b))[0] // smallest enclosing zone wins
    cand ? members.get(cand.id)!.push(l) : orphans.push(l)
  }
  type Draft = { sys: System; items: Obj[]; extent: number }
  const drafts: Draft[] = zones.map((z, i) => ({ sys: { id: 's_' + z.id, legacyId: z.id, name: z.title || `Zone ${i + 1}`, color: z.color || z.stroke || '#6C8CFF', x: (z.x + z.w / 2) * K, y: 0, z: (z.y + z.h / 2) * K, radius: 0 }, items: members.get(z.id)!, extent: 0 }))
  if (orphans.length) {
    const cx = orphans.reduce((s, l) => s + l.x + l.w / 2, 0) / orphans.length, cy = orphans.reduce((s, l) => s + l.y + l.h / 2, 0) / orphans.length
    drafts.push({ sys: { id: 's_inbox', inbox: true, name: 'Unsorted', color: '#8A94A8', x: cx * K, y: 0, z: cy * K, radius: 0 }, items: orphans, extent: 0 })
  }
  const bodies: Body[] = []
  for (const d of drafts) {
    d.sys.radius = 2 + Math.min(1.5, d.items.length / 200)
    const { orbits, extent } = assignOrbits(d.items.length, d.sys.radius); d.extent = extent
    d.items.forEach((l, i) => bodies.push({ id: 'b_' + l.id, legacyId: l.id, systemId: d.sys.id, title: l.title || hostOf(l.url) || 'Link', url: l.url || '', favicon: l.favicon ?? null,
      color: l.color && /^#/.test(l.color) ? l.color : hashColor(hostOf(l.url)), size: l.fav ? 0.65 : 0.5, fav: !!l.fav, tags: l.tags || [], notes: l.notes || '', orbit: orbits[i], created: now }))
  }
  const pos = drafts.map((d) => ({ x: d.sys.x, z: d.sys.z })); separate(pos, drafts.map((d) => d.extent))
  drafts.forEach((d, i) => { d.sys.x = pos[i].x; d.sys.z = pos[i].z })
  const report: Report = { systems: drafts.length, bodies: bodies.length, inbox: orphans.length, emptySystems: drafts.filter((d) => !d.items.length).length,
    legacyKept: { strokes: objs.filter((o) => o.type === 'stroke').length, texts: objs.filter((o) => o.type === 'text').length } }
  return { scene: { ...emptyScene(), schema: SCHEMA, systems: drafts.map((d) => d.sys), bodies, migration: { from: 'nexora2d', at: now, report } }, report }
}
