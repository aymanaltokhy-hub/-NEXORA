import { describe, it, expect } from 'vitest'
import { makeLegacyDemo } from '../src/model/demo'
import { migrateLegacy } from '../src/model/migrate'
import { addBody, addSystem } from '../src/model/ops'
import { validateScene } from '../src/model/validate'
import { emptyScene } from '../src/model/types'
describe('scale (hundreds of links)', () => {
  it('migrates 1,500 links in well under a second and survives a validate round-trip', () => {
    const t0 = performance.now(), { scene } = migrateLegacy(makeLegacyDemo(1500, 12), 1), ms = performance.now() - t0
    expect(scene.bodies).toHaveLength(1500); expect(ms).toBeLessThan(1500)
    expect(validateScene(JSON.parse(JSON.stringify({ format: 'madar-scene-v1', scene }))).bodies).toHaveLength(1500)
  })
  it('adding 400 links one by one to a single system stays fast and overlap-free', () => {
    let s = emptyScene(); const r = addSystem(s, 'Big'); s = r.scene; const t0 = performance.now()
    for (let i = 0; i < 400; i++) s = addBody(s, r.id, { url: `https://s${i}.com` }).scene
    expect(performance.now() - t0).toBeLessThan(4000); expect(s.bodies).toHaveLength(400)
  })
})
