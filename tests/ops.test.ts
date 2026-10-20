import { describe, it, expect } from 'vitest'
import { addBody, addSystem, deleteSystem, deleteBody, moveBody, duplicateBody, updateSystem, extentOf, INBOX } from '../src/model/ops'
import { validateScene } from '../src/model/validate'
import { emptyScene } from '../src/model/types'
import { bodyPosition, MAXR } from '../src/model/orbit'
const mk = () => { let s = emptyScene(); const a = addSystem(s, 'A'); s = a.scene; const b = addSystem(s, 'B'); s = b.scene; return { s, a: a.id, b: b.id } }
const minDist = (s: any, sysId: string) => { const sys = s.systems.find((x: any) => x.id === sysId), p = s.bodies.filter((x: any) => x.systemId === sysId).map((x: any) => bodyPosition(sys, x.orbit, 3)); let m = 1e9
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) m = Math.min(m, Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2])); return m }
describe('scene operations', () => {
  it('new systems get free, non-overlapping spots', () => { const { s } = mk(); expect(Math.hypot(s.systems[0].x - s.systems[1].x, s.systems[0].z - s.systems[1].z)).toBeGreaterThan(extentOf(s, s.systems[0].id)) })
  it('adding links keeps orbits overlap-free; links without a system go to Unsorted', () => {
    let { s, a } = mk(); for (let i = 0; i < 80; i++) s = addBody(s, a, { url: `https://x${i}.com` }).scene
    expect(s.bodies.filter((b) => b.systemId === a)).toHaveLength(80); expect(minDist(s, a)).toBeGreaterThanOrEqual(MAXR * 2 * 1.2)
    const r = addBody(s, null, { url: 'https://y.com' }); expect(r.scene.bodies.find((b) => b.id === r.id)!.systemId).toBe(INBOX)
  })
  it('deleting a system keeps its links (moved to Unsorted); deleting a link frees its slot', () => {
    let { s, a } = mk(); s = addBody(s, a, { url: 'https://a.com' }).scene; s = addBody(s, a, { url: 'https://b.com' }).scene
    const d = deleteSystem(s, a); expect(d.bodies).toHaveLength(2); expect(d.bodies.every((b) => b.systemId === INBOX)).toBe(true); expect(d.systems.some((x) => x.id === a)).toBe(false)
    expect(deleteSystem(d, INBOX)).toBe(d) // refuses to orphan links
    expect(deleteBody(s, s.bodies[0].id).bodies).toHaveLength(1)
  })
  it('moves and duplicates links between systems', () => {
    let { s, a, b } = mk(); const r = addBody(s, a, { url: 'https://a.com', title: 'مرحبا Hello' }); s = moveBody(r.scene, r.id, b)
    expect(s.bodies[0].systemId).toBe(b); const d = duplicateBody(s, r.id)!; expect(d.scene.bodies).toHaveLength(2); expect(d.scene.bodies[1].id).not.toBe(r.id)
    expect(updateSystem(s, a, { x: 5, y: -3, z: 9 }).systems.find((x) => x.id === a)).toMatchObject({ x: 5, y: -3, z: 9 })
  })
})
describe('import validation', () => {
  it('round-trips a valid scene and strips unsafe URLs', () => {
    let { s, a } = mk(); s = addBody(s, a, { url: 'https://ok.com' }).scene
    expect(validateScene({ format: 'madar-scene-v1', scene: s }).bodies[0].url).toBe('https://ok.com')
    const bad = JSON.parse(JSON.stringify(s)); bad.bodies[0].url = 'javascript:alert(1)'; expect(validateScene(bad).bodies[0].url).toBe('')
  })
  it('rejects malformed, NaN, orphaned and newer-schema data', () => {
    let { s, a } = mk(); s = addBody(s, a, { url: 'https://ok.com' }).scene
    const c = (f: (x: any) => void) => { const x = JSON.parse(JSON.stringify(s)); f(x); return x }
    expect(() => validateScene(null)).toThrow(); expect(() => validateScene(c((x) => (x.bodies[0].systemId = 'nope')))).toThrow()
    expect(() => validateScene(c((x) => (x.systems[0].x = null)))).toThrow(); expect(() => validateScene(c((x) => (x.schema = 99)))).toThrow(/newer/)
    expect(() => validateScene(c((x) => (x.bodies[0].color = 'url(evil)')))).toThrow()
  })
})
import { updateBody, updateOrbit, resetOrbit } from '../src/model/ops'
describe('orbit & size editing', () => {
  const base = () => { let { s, a, b } = mk(); const ids: string[] = []; for (let i = 0; i < 12; i++) { const r = addBody(s, a, { url: `https://x${i}.com` }); s = r.scene; ids.push(r.id) } return { s, a, b, ids } }
  it('direction flips the sign only and survives re-balancing; speed ratio is kept', () => {
    let { s, a, ids } = base(); s = updateOrbit(s, ids[0], { dir: -1 }); expect(s.bodies.find((x) => x.id === ids[0])!.orbit.speed).toBeLessThan(0)
    s = updateOrbit(s, ids[0], { speedMult: 2 }); const m = Math.abs(s.bodies.find((x) => x.id === ids[0])!.orbit.speed) / (0.5 / Math.sqrt(s.bodies.find((x) => x.id === ids[0])!.orbit.radius)); expect(m).toBeCloseTo(2, 5)
    s = addBody(s, a, { url: 'https://new.com' }).scene; const o = s.bodies.find((x) => x.id === ids[0])!.orbit; expect(o.speed).toBeLessThan(0); expect(Math.abs(o.speed) / (0.5 / Math.sqrt(o.radius))).toBeCloseTo(2, 5)
  })
  it('custom orbits are kept by auto-layout and can be reset; distance never goes inside the planet', () => {
    let { s, a, ids } = base(); s = updateOrbit(s, ids[3], { radius: 30, ecc: 0.4, incl: 0.5 }); const o1 = s.bodies.find((x) => x.id === ids[3])!.orbit; expect(o1).toMatchObject({ radius: 30, ecc: 0.4, custom: true })
    s = addBody(s, a, { url: 'https://n.com' }).scene; expect(s.bodies.find((x) => x.id === ids[3])!.orbit.radius).toBe(30)
    s = updateOrbit(s, ids[3], { radius: 0.1 }); expect(s.bodies.find((x) => x.id === ids[3])!.orbit.radius).toBeGreaterThan(s.systems.find((x) => x.id === a)!.radius)
    s = resetOrbit(s, ids[3]); expect(s.bodies.find((x) => x.id === ids[3])!.orbit.custom).toBeFalsy()
  })
  it('enlarging a body keeps all auto orbits overlap-free (rings widen)', () => {
    let { s, a, ids } = base(); s = updateBody(s, ids[0], { size: 1.8 })
    const sys = s.systems.find((x) => x.id === a)!, p = s.bodies.filter((x) => x.systemId === a).map((x) => ({ p: bodyPosition(sys, x.orbit, 7), r: x.size })); let ok = true
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (Math.hypot(p[i].p[0] - p[j].p[0], p[i].p[1] - p[j].p[1], p[i].p[2] - p[j].p[2]) < p[i].r + p[j].r) ok = false
    expect(ok).toBe(true); expect(updateBody(s, ids[0], { size: 99 }).bodies.find((x) => x.id === ids[0])!.size).toBe(2.5)
  })
  it('resizing a planet re-lays rings outside it and marks the size custom; elliptical positions stay on the ellipse', () => {
    let { s, a, ids } = base(); s = updateSystem(s, a, { radius: 6 }); const sys = s.systems.find((x) => x.id === a)!; expect(sys).toMatchObject({ radius: 6, radiusCustom: true })
    expect(Math.min(...s.bodies.filter((x) => x.systemId === a).map((x) => x.orbit.radius))).toBeGreaterThan(6 + 1)
    const o = { radius: 10, angle: 0, speed: 0.1, incl: 0, node: 0, ecc: 0.6 }, p = bodyPosition({ x: 0, y: 0, z: 0 }, o, 0), q = bodyPosition({ x: 0, y: 0, z: 0 }, { ...o, angle: Math.PI / 2 }, 0)
    expect(Math.hypot(p[0], p[2])).toBeCloseTo(10, 5); expect(Math.hypot(q[0], q[2])).toBeCloseTo(10 * Math.sqrt(1 - 0.36), 5)
  })
  it('glow and new orbit fields survive import validation (and bad glow is dropped)', () => {
    let { s, a, ids } = base(); s = updateOrbit(s, ids[1], { ecc: 0.3, radius: 12 }); s = updateBody(s, ids[1], { glow: { color: '#ff8800', intensity: 0.7 } }); s = updateSystem(s, a, { glow: { color: '#ffee88', intensity: 1 } })
    const v = validateScene(JSON.parse(JSON.stringify({ format: 'madar-scene-v1', scene: s }))); expect(v.bodies.find((x) => x.id === ids[1])).toMatchObject({ glow: { color: '#ff8800', intensity: 0.7 }, orbit: { ecc: 0.3, custom: true } }); expect(v.systems.find((x) => x.id === a)!.glow!.intensity).toBe(1)
    const bad = JSON.parse(JSON.stringify(s)); bad.bodies[0].glow = { color: 'javascript:1', intensity: 5 }; expect(validateScene(bad).bodies[0].glow).toBeUndefined()
  })
})
