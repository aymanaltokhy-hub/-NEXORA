import type { Orbit, Vec3 } from './types'
export const MAXR = 0.65                 // largest body radius
export const STEP = MAXR * 2 * 1.3       // ring spacing: bodies on different rings can never touch (distance >= |r1-r2|)
/** Deterministic non-overlapping orbit layout: concentric rings with small per-ring tilt. */
export function assignOrbits(count: number, planetR: number) {
  const orbits: Orbit[] = []; let ring = 0
  while (orbits.length < count) {
    const r = planetR + 1.4 + ring * STEP
    const cap = Math.max(3, Math.floor((2 * Math.PI * r) / STEP))
    const n = Math.min(cap, count - orbits.length)
    const incl = ((ring % 3) - 1) * 0.28, node = ring * 0.9, speed = 0.5 / Math.sqrt(r), phase = ring * 0.37
    for (let i = 0; i < n; i++) orbits.push({ radius: r, angle: phase + (2 * Math.PI * i) / n, speed, incl, node })
    ring++
  }
  return { orbits, extent: (orbits.length ? orbits[orbits.length - 1].radius : planetR) + MAXR }
}
/** World position of a body at time t (seconds). Pure: orbital motion is never persisted. */
export function bodyPosition(c: { x: number; y: number; z: number }, o: Orbit, t = 0, speedScale = 1): Vec3 {
  const a = o.angle + t * o.speed * speedScale, x = o.radius * Math.cos(a), z = o.radius * Math.sin(a)
  const y2 = -z * Math.sin(o.incl), z2 = z * Math.cos(o.incl)
  return [c.x + x * Math.cos(o.node) + z2 * Math.sin(o.node), c.y + y2, c.z - x * Math.sin(o.node) + z2 * Math.cos(o.node)]
}
/** Deterministic push-apart so planetary systems never overlap after converting 2D positions. */
export function separate(pos: { x: number; z: number }[], extents: number[], margin = 4) {
  for (let it = 0; it < 400; it++) {
    let moved = false
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      let dx = pos[j].x - pos[i].x, dz = pos[j].z - pos[i].z, d = Math.hypot(dx, dz); const need = extents[i] + extents[j] + margin
      if (d >= need) continue
      if (d < 1e-6) { dx = Math.cos(i * 2.399); dz = Math.sin(i * 2.399); d = 1 }
      const k = (need - d) / 2 / d; pos[i].x -= dx * k; pos[i].z -= dz * k; pos[j].x += dx * k; pos[j].z += dz * k; moved = true
    }
    if (!moved) break
  }
}
