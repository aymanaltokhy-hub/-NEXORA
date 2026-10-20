import { assignOrbits, baseSpeed, MAXR } from './orbit'
import type { Body, Orbit, Scene, System, Vec3 } from './types'
const uid = () => crypto.randomUUID()
export const INBOX = 's_inbox'
export const extentOf = (sc: Scene, id: string) => Math.max(sc.systems.find((s) => s.id === id)?.radius ?? 2, ...sc.bodies.filter((b) => b.systemId === id).map((b) => b.orbit.radius)) + Math.max(MAXR, ...sc.bodies.filter((b) => b.systemId === id).map((b) => b.size))
/** Re-lays a system's auto rings so bodies never overlap. Keeps each body's direction and speed ratio; leaves user-customized orbits (and a custom planet size) alone. Pure. */
export function rebalance(sc: Scene, id: string): Scene {
  const sys = sc.systems.find((s) => s.id === id); if (!sys) return sc
  const mem = sc.bodies.filter((b) => b.systemId === id).sort((a, b) => a.created - b.created || a.id.localeCompare(b.id)), auto = mem.filter((b) => !b.orbit.custom)
  const maxR = Math.max(MAXR, ...mem.map((b) => b.size)), radius = sys.radiusCustom ? sys.radius : 2 + Math.min(1.5, mem.length / 200)
  const { orbits } = assignOrbits(auto.length, radius, maxR), m = new Map(auto.map((b, i) => {
    const o = orbits[i], mult = b.orbit.speed ? Math.abs(b.orbit.speed) / baseSpeed(b.orbit.radius) : 1, dir = b.orbit.speed < 0 ? -1 : 1
    return [b.id, { ...o, speed: dir * mult * baseSpeed(o.radius) }]
  }))
  return { ...sc, systems: sc.systems.map((s) => (s.id === id ? { ...s, radius } : s)), bodies: sc.bodies.map((b) => (m.has(b.id) ? { ...b, orbit: m.get(b.id)! } : b)) }
}
/** Free spot to the right of everything, so a new system never overlaps an existing one. */
export function freeSpot(sc: Scene, ext = 8): Vec3 {
  const right = sc.systems.reduce((m, s) => Math.max(m, s.x + extentOf(sc, s.id)), -Infinity)
  return [sc.systems.length ? right + ext + 4 : 0, 0, 0]
}
export function ensureInbox(sc: Scene): Scene {
  if (sc.systems.some((s) => s.id === INBOX)) return sc
  const [x, y, z] = freeSpot(sc)
  return { ...sc, systems: [...sc.systems, { id: INBOX, inbox: true, name: 'Unsorted', color: '#8A94A8', x, y, z, radius: 2 }] }
}
export function addSystem(sc: Scene, name: string, color = '#6C8CFF', at?: Vec3): { scene: Scene; id: string } {
  const id = uid(), [x, y, z] = at || freeSpot(sc)
  return { scene: { ...sc, systems: [...sc.systems, { id, name: name.slice(0, 80) || 'System', color, x, y, z, radius: 2 }] }, id }
}
export function addBody(sc: Scene, systemId: string | null, p: Partial<Body> & { url: string }, now = Date.now()): { scene: Scene; id: string } {
  let s = sc; if (!systemId || !s.systems.some((x) => x.id === systemId)) { s = ensureInbox(s); systemId = INBOX }
  const id = uid(), host = (() => { try { return new URL(p.url).hostname.replace(/^www\./, '') } catch { return '' } })()
  const b: Body = { id, systemId, title: (p.title || host || 'Link').slice(0, 120), url: p.url, favicon: p.favicon ?? null, color: p.color || `hsl(${[...host].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360} 60% 60%)`,
    size: p.size ?? 0.5, fav: !!p.fav, tags: p.tags || [], notes: p.notes || '', orbit: { radius: 99, angle: 0, speed: 0, incl: 0, node: 0 }, created: now }
  return { scene: rebalance({ ...s, bodies: [...s.bodies, b] }, systemId), id }
}
export const clampSize = (v: number) => Math.min(2.5, Math.max(0.2, v))
/** Updates a link/body. Changing its size can change the ring spacing needed by the whole system, so rings are re-laid only when the largest body changes. */
export function updateBody(sc: Scene, id: string, patch: Partial<Body>): Scene {
  const old = sc.bodies.find((b) => b.id === id); if (!old) return sc
  const p = { ...patch, id: old.id, systemId: old.systemId } as Body; if (p.size !== undefined) p.size = clampSize(p.size)
  const n = { ...sc, bodies: sc.bodies.map((b) => (b.id === id ? { ...b, ...p } : b)) }
  if (p.size === undefined) return n
  const mx = (s: Scene) => Math.max(MAXR, ...s.bodies.filter((b) => b.systemId === old.systemId).map((b) => b.size))
  return mx(n) !== mx(sc) ? rebalance(n, old.systemId) : n
}
/** User edits of one body's orbit. Distance/shape/tilt/phase mark it custom (auto-layout then leaves it alone); direction and speed do not. */
export function updateOrbit(sc: Scene, id: string, patch: Partial<Orbit> & { dir?: 1 | -1; speedMult?: number }): Scene {
  const b = sc.bodies.find((x) => x.id === id), sys = b && sc.systems.find((s) => s.id === b.systemId); if (!b || !sys) return sc
  const o = { ...b.orbit }, { dir, speedMult, ...geo } = patch
  const moved = ['radius', 'ecc', 'incl', 'node', 'angle'].some((k) => (geo as any)[k] !== undefined)
  Object.assign(o, geo)
  o.radius = Math.min(80, Math.max(sys.radius + b.size + 0.4, o.radius)); o.ecc = Math.min(0.85, Math.max(0, o.ecc || 0)); o.incl = Math.min(Math.PI / 2, Math.max(-Math.PI / 2, o.incl))
  const mag = speedMult !== undefined ? Math.min(4, Math.max(0.05, speedMult)) * baseSpeed(o.radius) : Math.abs(o.speed) || baseSpeed(o.radius), sign = dir ?? (b.orbit.speed < 0 ? -1 : 1)
  o.speed = sign * mag; if (moved) o.custom = true
  return { ...sc, bodies: sc.bodies.map((x) => (x.id === id ? { ...x, orbit: o } : x)) }
}
export function resetOrbit(sc: Scene, id: string): Scene {
  const b = sc.bodies.find((x) => x.id === id); if (!b) return sc
  return rebalance({ ...sc, bodies: sc.bodies.map((x) => (x.id === id ? { ...x, orbit: { ...x.orbit, custom: false } } : x)) }, b.systemId)
}
/** Updating a system. Resizing the planet makes its size custom and re-lays the rings around it. */
export function updateSystem(sc: Scene, id: string, patch: Partial<System>): Scene {
  const p = { ...patch, id } as System; if (p.radius !== undefined) { p.radius = Math.min(14, Math.max(0.8, p.radius)); p.radiusCustom = true }
  const n = { ...sc, systems: sc.systems.map((s) => (s.id === id ? { ...s, ...p } : s)) }
  return p.radius !== undefined ? rebalance(n, id) : n
}
export function deleteBody(sc: Scene, id: string): Scene { const b = sc.bodies.find((x) => x.id === id); return b ? rebalance({ ...sc, bodies: sc.bodies.filter((x) => x.id !== id) }, b.systemId) : sc }
export function duplicateBody(sc: Scene, id: string, now = Date.now()): { scene: Scene; id: string } | null {
  const b = sc.bodies.find((x) => x.id === id); if (!b) return null; const nid = uid()
  return { scene: rebalance({ ...sc, bodies: [...sc.bodies, { ...b, id: nid, legacyId: undefined, created: now }] }, b.systemId), id: nid }
}
export function moveBody(sc: Scene, id: string, systemId: string): Scene {
  const b = sc.bodies.find((x) => x.id === id); if (!b || b.systemId === systemId || !sc.systems.some((s) => s.id === systemId)) return sc
  return rebalance(rebalance({ ...sc, bodies: sc.bodies.map((x) => (x.id === id ? { ...x, systemId, created: Date.now(), orbit: { ...x.orbit, custom: false } } : x)) }, b.systemId), systemId)
}
/** Deleting a system never deletes its links: they move to Unsorted. */
export function deleteSystem(sc: Scene, id: string): Scene {
  const sys = sc.systems.find((s) => s.id === id); if (!sys) return sc
  const has = sc.bodies.some((b) => b.systemId === id)
  if (!has) return { ...sc, systems: sc.systems.filter((s) => s.id !== id) }
  if (id === INBOX) return sc // refuse: would orphan links
  let n = ensureInbox(sc); n = { ...n, bodies: n.bodies.map((b) => (b.systemId === id ? { ...b, systemId: INBOX } : b)), systems: n.systems.filter((s) => s.id !== id) }
  return rebalance(n, INBOX)
}
