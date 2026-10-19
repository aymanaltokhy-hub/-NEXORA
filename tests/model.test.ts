import { describe, it, expect } from 'vitest'
import { assignOrbits, bodyPosition, separate, MAXR } from '../src/model/orbit'
import { migrateLegacy } from '../src/model/migrate'
import { makeLegacyDemo } from '../src/model/demo'

describe('orbits', () => {
  it('never overlap, at any time, for up to 400 bodies, and never hit the planet', () => {
    for (const n of [1, 2, 7, 60, 400]) {
      const planet = 2.5, { orbits } = assignOrbits(n, planet), c = { x: 0, y: 0, z: 0 }
      for (const t of [0, 13.7, 211.3]) {
        const p = orbits.map((o) => bodyPosition(c, o, t))
        let min = 1e9
        for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) min = Math.min(min, Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]))
        if (n > 1) expect(min).toBeGreaterThanOrEqual(MAXR * 2 * 1.2)
        for (const q of p) expect(Math.hypot(...q)).toBeGreaterThan(planet + MAXR)
      }
    }
  })
  it('is deterministic and pure (no per-frame state)', () => {
    expect(assignOrbits(50, 2)).toEqual(assignOrbits(50, 2))
    const o = assignOrbits(3, 2).orbits[0]; expect(bodyPosition({ x: 1, y: 2, z: 3 }, o, 5)).toEqual(bodyPosition({ x: 1, y: 2, z: 3 }, o, 5))
  })
  it('separates overlapping systems', () => {
    const pos = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }], ext = [8, 8, 8]; separate(pos, ext)
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(pos[i].x - pos[j].x, pos[i].z - pos[j].z)).toBeGreaterThanOrEqual(16)
  })
})

describe('migration from NEXORA 2D', () => {
  const legacy = makeLegacyDemo(300, 6), { scene, report } = migrateLegacy(legacy, 1)
  const links = legacy.filter((o) => o.type === 'link')
  it('keeps every link exactly once, with a valid system', () => {
    expect(scene.bodies).toHaveLength(300); expect(new Set(scene.bodies.map((b) => b.id)).size).toBe(300)
    const sys = new Set(scene.systems.map((s) => s.id)); expect(scene.bodies.every((b) => sys.has(b.systemId))).toBe(true)
    expect(links.every((l) => scene.bodies.some((b) => b.legacyId === l.id && b.url === l.url && b.title === l.title))).toBe(true)
  })
  it('turns zones into systems; links outside any zone go to Unsorted', () => {
    expect(scene.systems.filter((s) => !s.inbox)).toHaveLength(6)
    const inbox = scene.systems.find((s) => s.inbox)!; expect(inbox).toBeTruthy()
    expect(scene.bodies.filter((b) => b.systemId === inbox.id)).toHaveLength(report.inbox); expect(report.inbox).toBeGreaterThan(10)
  })
  it('reports (not drops) what stays in the classic board', () => { expect(report.legacyKept).toEqual({ strokes: 8, texts: 4 }) })
  it('lays systems out in 3D without overlap and keeps links with their system', () => {
    const ext = (id: string) => Math.max(...scene.bodies.filter((b) => b.systemId === id).map((b) => b.orbit.radius), 0) + MAXR
    for (let i = 0; i < scene.systems.length; i++) for (let j = i + 1; j < scene.systems.length; j++) {
      const a = scene.systems[i], b = scene.systems[j]; expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThanOrEqual(ext(a.id) + ext(b.id))
    }
  })
  it('is deterministic and handles empty data', () => {
    expect(migrateLegacy(legacy, 1).scene).toEqual(scene)
    const e = migrateLegacy([], 1); expect(e.scene.systems).toHaveLength(0); expect(e.report.bodies).toBe(0)
  })
  it('smallest enclosing zone wins when zones overlap', () => {
    const big = { id: 'big', type: 'zone', x: 0, y: 0, w: 1000, h: 1000, rotation: 0, z: 1, shape: 'rect' }, small = { id: 'small', type: 'zone', x: 100, y: 100, w: 200, h: 200, rotation: 0, z: 2, shape: 'rect' }
    const l = { id: 'l', type: 'link', x: 150, y: 150, w: 40, h: 40, rotation: 0, z: 3, url: 'https://a.com', title: 'A' }
    expect(migrateLegacy([big, small, l] as any).scene.bodies[0].systemId).toBe('s_small')
  })
})
