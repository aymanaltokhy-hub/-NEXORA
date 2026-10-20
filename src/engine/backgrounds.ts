import * as THREE from 'three'
import { toColor } from './color'
import type { Preset } from '../model/types'
export interface Bg { group: THREE.Group; update(t: number, dt: number): void; dispose(): void }
export interface BgOpts { starDensity: number; effects: number; coarse: boolean }
interface Part { obj: THREE.Object3D; update?(t: number, dt: number): void }
const AD = THREE.AdditiveBlending
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
let glowTex: THREE.CanvasTexture | null = null
export function glowTexture() {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(0.6, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128)
    glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace }
  return glowTex
}
export const glowSprite = (color: THREE.ColorRepresentation, scale: number, opacity: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: AD, transparent: true, depthWrite: false, opacity })); s.scale.setScalar(scale); return s
}
function stars(o: BgOpts): Part {
  const r = rng(12345), n = Math.round((300 + o.starDensity * 2600) * (o.coarse ? 0.6 : 1)), a = new Float32Array(n * 3), col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * 6.2832, k = Math.sqrt(1 - u * u), R = 2500; a[i * 3] = R * k * Math.cos(th); a[i * 3 + 1] = R * u; a[i * 3 + 2] = R * k * Math.sin(th)
    const v = 0.45 + r() * 0.55, w = r(); col[i * 3] = v * (w > 0.8 ? 1 : 0.9); col[i * 3 + 1] = v * (w > 0.9 ? 0.85 : 0.95); col[i * 3 + 2] = Math.min(1, v + 0.12) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.2 + o.effects * 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55 + o.effects * 0.4, depthWrite: false }))
  return { obj: p, update: (_t, dt) => { p.rotation.y += dt * 0.004 } }
}
function nebula(o: BgOpts): Part {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d')!
  for (const [col, px, py, rad] of [['#3b4fd8', 0.2, 0.4, 280], ['#7a3fd0', 0.55, 0.3, 300], ['#1f9cc0', 0.8, 0.6, 260], ['#c04a8a', 0.35, 0.72, 250], ['#2fbf9a', 0.92, 0.25, 200]] as [string, number, number, number][]) {
    const gr = x.createRadialGradient(px * 1024, py * 512, 10, px * 1024, py * 512, rad); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 512) }
  const tx = new THREE.CanvasTexture(c), base = 0.15 + o.effects * 0.55; tx.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 16), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide, transparent: true, opacity: base, depthWrite: false }))
  return { obj: m, update: (t, dt) => { m.rotation.y += dt * 0.004; (m.material as THREE.MeshBasicMaterial).opacity = base * (0.9 + 0.1 * Math.sin(t * 0.25)) } }
}
function galaxy(o: BgOpts, cfg: { pos: number[]; R: number; tilt: number[]; hue?: number }): Part {
  const r = rng(cfg.R | 0), gauss = () => (r() + r() + r() + r() - 2) / 0.58, n = Math.round((o.coarse ? 3500 : 9000) * (cfg.R > 300 ? 1 : 0.5)), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), arms = 4, R = cfg.R
  const core = new THREE.Color(1, 0.85, 0.6), edge = new THREE.Color().setHSL(cfg.hue ?? 0.62, 0.8, 0.7)
  for (let i = 0; i < n; i++) { const rr = Math.pow(r(), 0.55) * R, arm = Math.floor(r() * arms), ang = arm * (6.2832 / arms) + (rr / R) * 5 + gauss() * (0.12 + 0.35 * (1 - rr / R))
    pos[i * 3] = Math.cos(ang) * rr; pos[i * 3 + 1] = gauss() * R * 0.03 * (1 - 0.6 * rr / R); pos[i * 3 + 2] = Math.sin(ang) * rr
    const c = core.clone().lerp(edge, Math.min(1, rr / R * 1.2)), v = 0.55 + r() * 0.45; col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const disc = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4 + o.effects * 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55 + o.effects * 0.4, depthWrite: false, blending: AD }))
  const grp = new THREE.Group(); grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]); grp.rotation.set(cfg.tilt[0], cfg.tilt[1], cfg.tilt[2]); grp.add(disc)
  const halo = glowSprite(0xffd9a0, R * 0.9, 0.35 + o.effects * 0.4); grp.add(halo)
  return { obj: grp, update: (_t, dt) => { disc.rotation.y += dt * 0.03 } }
}
function diskMaterial(inner: number, outer: number, bright: number) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: AD, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uIn: { value: inner }, uOut: { value: outer }, uBright: { value: bright } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vP; uniform float uTime, uIn, uOut, uBright; void main(){ float r = length(vP); float t = (r - uIn) / (uOut - uIn); if (t < 0.0 || t > 1.0) discard; float a = atan(vP.y, vP.x); float sw = 0.5 + 0.5 * sin(a * 5.0 - uTime * 1.6 - r * 0.045); vec3 c = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.42, 0.08), pow(t, 0.55)); float al = (1.0 - t) * (0.45 + 0.65 * sw) * uBright; gl_FragColor = vec4(c * al * 1.5, al); }' })
}
function blackHole(o: BgOpts): Part {
  const g = new THREE.Group(); g.position.set(-1150, 280, -1850); const b = 0.6 + o.effects * 0.8
  g.add(glowSprite(0xff8a3a, 900, 0.18 + o.effects * 0.2))
  const hole = new THREE.Mesh(new THREE.SphereGeometry(95, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); g.add(hole)
  const m1 = diskMaterial(120, 340, b), disk = new THREE.Mesh(new THREE.RingGeometry(120, 340, 128, 1), m1); disk.rotation.x = 1.25; g.add(disk)
  const m2 = diskMaterial(104, 250, b * 0.55), lens = new THREE.Mesh(new THREE.RingGeometry(104, 250, 128, 1), m2); g.add(lens) // lensed light bending over the hole
  g.add(new THREE.Mesh(new THREE.RingGeometry(99, 108, 128), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.8, blending: AD, depthWrite: false })))
  return { obj: g, update: (t) => { m1.uniforms.uTime.value = t; m2.uniforms.uTime.value = t } }
}
function solar(o: BgOpts): Part {
  const g = new THREE.Group(); g.position.set(1150, -300, -1900); const tilt = new THREE.Group(); tilt.rotation.set(0.35, 0, 0.15); g.add(tilt)
  tilt.add(glowSprite(0xffc26b, 520, 0.5 + o.effects * 0.4)); tilt.add(new THREE.Mesh(new THREE.SphereGeometry(42, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })))
  const defs: [number, number, number][] = [[110, 8, 0xb5a58c], [170, 12, 0xe8c27a], [240, 13, 0x5b8de0], [330, 10, 0xd0644a], [440, 26, 0xd9b88a], [560, 22, 0xe6d6a0]], list: { m: THREE.Mesh; r: number; a: number }[] = []
  defs.forEach(([r, s, c], i) => { const pts: number[] = []; for (let k = 0; k < 96; k++) pts.push(Math.cos((k / 96) * 6.2832) * r, 0, Math.sin((k / 96) * 6.2832) * r)
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); tilt.add(new THREE.LineLoop(lg, new THREE.LineBasicMaterial({ color: 0x8fa0c0, transparent: true, opacity: 0.18, depthWrite: false })))
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), new THREE.MeshBasicMaterial({ color: c })); tilt.add(m); list.push({ m, r, a: i * 1.7 }) })
  return { obj: g, update: (_t, dt) => list.forEach((p) => { p.a += dt * 0.22 * Math.sqrt(100 / p.r); p.m.position.set(Math.cos(p.a) * p.r, 0, Math.sin(p.a) * p.r) }) }
}
function comets(o: BgOpts): Part {
  const g = new THREE.Group(), r = rng(777), items: any[] = [], total = o.coarse ? 4 : 7
  for (let i = 0; i < total; i++) {
    const fast = i >= Math.ceil(total / 2), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3))
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, blending: AD, transparent: true, depthWrite: false })), head = glowSprite(fast ? 0xffffff : 0xaee0ff, fast ? 26 : 46, 0.95)
    line.visible = head.visible = false; g.add(line, head); items.push({ line, head, p: new THREE.Vector3(), d: new THREE.Vector3(), speed: 0, len: 0, wait: r() * 6, fast })
  }
  const spawn = (c: any) => { const u = r() * 1.4 - 0.5, th = r() * 6.2832, k = Math.sqrt(Math.max(0, 1 - u * u)); c.p.set(1700 * k * Math.cos(th), 1700 * u, 1700 * k * Math.sin(th))
    const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5), n = c.p.clone().normalize(); c.d.copy(v.sub(n.multiplyScalar(v.dot(n)))).normalize()
    c.speed = c.fast ? 900 + r() * 500 : 140 + r() * 120; c.len = c.fast ? 160 : 320 + r() * 160; c.wait = c.fast ? 1 + r() * 7 : 3 + r() * 12; c.travel = 0 }
  items.forEach(spawn)
  return { obj: g, update: (_t, dt) => items.forEach((c) => {
    if (c.wait > 0) { c.wait -= dt; if (c.wait <= 0) { c.line.visible = c.head.visible = true } else { c.line.visible = c.head.visible = false; return } }
    c.p.addScaledVector(c.d, c.speed * dt); c.travel += c.speed * dt
    const a = c.line.geometry.attributes.position as THREE.BufferAttribute, t = c.p.clone().addScaledVector(c.d, -c.len); a.setXYZ(0, c.p.x, c.p.y, c.p.z); a.setXYZ(1, t.x, t.y, t.z); a.needsUpdate = true; c.head.position.copy(c.p)
    if (c.travel > (c.fast ? 2600 : 3200)) { c.line.visible = c.head.visible = false; spawn(c) } }) }
}
export function buildBackground(preset: Preset, o: BgOpts): Bg {
  const g = new THREE.Group(), parts: Part[] = [], add = (p: Part) => { g.add(p.obj); parts.push(p) }
  if (preset !== 'black') add(stars(o))
  if (preset === 'nebula' || preset === 'cosmos') add(nebula(o))
  if (preset === 'galaxy') { add(galaxy(o, { pos: [800, 380, -1800], R: 560, tilt: [1.05, 0, 0.35] })); add(galaxy(o, { pos: [-1500, -250, -1500], R: 200, tilt: [0.5, 0.8, 0], hue: 0.08 })) }
  if (preset === 'cosmos') add(galaxy(o, { pos: [-700, 620, -1900], R: 420, tilt: [0.9, 0.2, -0.3] }))
  if (preset === 'blackhole' || preset === 'cosmos') add(blackHole(o))
  if (preset === 'solar' || preset === 'cosmos') add(solar(o))
  if (preset === 'comets' || preset === 'cosmos') add(comets(o))
  return { group: g, update: (t, dt) => parts.forEach((p) => p.update?.(t, dt)),
    dispose: () => g.traverse((x: any) => { x.geometry?.dispose?.(); const m = x.material; if (m && !(m.map === glowTex)) { m.map?.dispose?.(); m.dispose?.() } else m?.dispose?.() }) }
}
void toColor
