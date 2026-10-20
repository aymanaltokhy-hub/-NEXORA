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
