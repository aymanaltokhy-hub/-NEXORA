import { SCHEMA, PRESETS, type Scene } from './types'
const num = (v: any) => typeof v === 'number' && Number.isFinite(v)
const str = (v: any, max = 5000) => typeof v === 'string' && v.length <= max
const glowOf = (g: any) => (g && color(g.color) && num(g.intensity) ? { color: g.color, intensity: Math.min(1, Math.max(0, g.intensity)) } : undefined)
const color = (v: any) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|hsl\([^)]{1,40}\)|rgb\([^)]{1,40}\))$/i.test(v)
/** Validates and sanitizes an imported scene (never trusts the file). Returns a clean copy or throws with a clear reason. */
export function validateScene(raw: any): Scene {
  if (!raw || typeof raw !== 'object') throw new Error('Not a MADAR file')
  const s = raw.scene && raw.format === 'madar-scene-v1' ? raw.scene : raw
  if (!num(s.schema) || s.schema > SCHEMA) throw new Error('File was saved by a newer version of MADAR')
  if (!Array.isArray(s.systems) || !Array.isArray(s.bodies) || s.systems.length > 2000 || s.bodies.length > 20000) throw new Error('Invalid or too large')
  const ids = new Set<string>()
  const systems = s.systems.map((x: any) => {
    if (!str(x?.id, 80) || !str(x.name, 200) || !color(x.color) || ![x.x, x.y, x.z, x.radius].every(num) || ids.has(x.id)) throw new Error('Invalid system')
    ids.add(x.id); return { id: x.id, name: x.name, color: x.color, x: x.x, y: x.y, z: x.z, radius: Math.min(20, Math.max(0.5, x.radius)), ...(x.inbox ? { inbox: true } : {}), ...(x.radiusCustom ? { radiusCustom: true } : {}), ...(glowOf(x.glow) ? { glow: glowOf(x.glow) } : {}) }
  })
  const bids = new Set<string>()
  const bodies = s.bodies.map((b: any) => {
    const o = b?.orbit
    if (!str(b?.id, 80) || !ids.has(b.systemId) || bids.has(b.id) || !str(b.title, 300) || !str(b.url, 2048) || !color(b.color) || !num(b.size) || !o || ![o.radius, o.angle, o.speed, o.incl, o.node].every(num)) throw new Error('Invalid link')
    bids.add(b.id)
    const url = /^https?:\/\//i.test(b.url) ? b.url : '' // never keep javascript:/file: URLs
    return { id: b.id, systemId: b.systemId, title: b.title, url, favicon: typeof b.favicon === 'string' && /^data:image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon|svg\+xml);base64,/.test(b.favicon) && b.favicon.length < 300000 ? b.favicon : null,
      color: b.color, size: Math.min(2.5, Math.max(0.2, b.size)), ...(glowOf(b.glow) ? { glow: glowOf(b.glow) } : {}), fav: !!b.fav, tags: Array.isArray(b.tags) ? b.tags.filter((t: any) => str(t, 60)).slice(0, 30) : [], notes: str(b.notes, 20000) ? b.notes : '', vaultIds: Array.isArray(b.vaultIds) ? b.vaultIds.filter((t: any) => str(t, 80)).slice(0, 20) : [],
      orbit: { radius: o.radius, angle: o.angle, speed: o.speed, incl: o.incl, node: o.node, ...(num(o.ecc) ? { ecc: Math.min(0.85, Math.max(0, o.ecc)) } : {}), ...(o.custom ? { custom: true } : {}) }, created: num(b.created) ? b.created : Date.now() }
  })
  const st = s.settings || {}, bg = st.background || {}, cam = st.camera || {}
  const settings = {
    background: { preset: (PRESETS as readonly string[]).includes(bg.preset) ? bg.preset : 'stars', color: color(bg.color) ? bg.color : '#070A12', starDensity: num(bg.starDensity) ? Math.min(1, Math.max(0, bg.starDensity)) : 0.5, effects: num(bg.effects) ? Math.min(1, Math.max(0, bg.effects)) : 0.4, imageId: null },
    view: { labels: ['near', 'all', 'off'].includes(st.view?.labels) ? st.view.labels : 'near', icons: st.view?.icons !== false },
    motion: { enabled: st.motion?.enabled !== false, speed: num(st.motion?.speed) ? Math.min(5, Math.max(0, st.motion.speed)) : 1 },
    camera: Array.isArray(cam.pos) && Array.isArray(cam.target) && cam.pos.length === 3 && cam.target.length === 3 && [...cam.pos, ...cam.target].every(num) ? { pos: cam.pos, target: cam.target, moved: !!cam.moved } : { pos: [0, 40, 90], target: [0, 0, 0] }
  }
  return { schema: SCHEMA, systems, bodies, settings: settings as any }
}
