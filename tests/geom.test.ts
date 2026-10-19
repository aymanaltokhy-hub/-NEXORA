import { describe, it, expect } from 'vitest'
import { pip, norm, inside } from '../src/classic/geom'
const o = (p: any) => ({ id: 'a', type: 'zone', x: 0, y: 0, w: 100, h: 100, rotation: 0, z: 1, ...p }) as any
describe('geometry', () => {
  const tri = [0, 0, 100, 0, 50, 100]
  it('point in polygon', () => { expect(pip(tri, 50, 20)).toBe(true); expect(pip(tri, 5, 90)).toBe(false) })
  it('normalizes points to a bbox', () => { const n = norm([10, 20, 30, 60]); expect([n.x, n.y, n.w, n.h]).toEqual([10, 20, 20, 40]); expect(n.points).toEqual([0, 0, 20, 40]) })
  it('contains by center for rect, ellipse and poly zones', () => {
    const l = (x: number, y: number) => o({ type: 'link', x, y, w: 10, h: 10 })
    expect(inside(o({ shape: 'rect' }), l(40, 40))).toBe(true); expect(inside(o({ shape: 'rect' }), l(200, 40))).toBe(false)
    expect(inside(o({ shape: 'ellipse' }), l(0, 0))).toBe(false); expect(inside(o({ shape: 'poly', points: tri }), l(45, 20))).toBe(true)
  })
})
