import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { bodyPosition } from '../model/orbit'
import type { Scene, Settings, Vec3 } from '../model/types'

export type Sel = { kind: 'body' | 'system'; id: string } | null
export interface EngineEvents {
  onPick(sel: Sel): void
  onSystemMoved(id: string, pos: Vec3, final: boolean): void
  onCamera(c: { pos: Vec3; target: Vec3 }): void
  onLost(): void
  onRestored(): void
}
const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches // phones/tablets: touch input, weaker GPUs
const LABELS = COARSE ? 14 : 28
/** Accepts #hex and both legacy `hsl(h, s%, l%)` and modern `hsl(h s% l%)` strings. */
export const toColor = (v: string) => { const c = new THREE.Color(); const m = /^hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/i.exec(v); if (m) return c.setHSL(+m[1] / 360, +m[2] / 100, +m[3] / 100); try { c.set(v) } catch { c.set('#6c8cff') } return c }
const sigOf = (sc: Scene) => sc.systems.map((s) => [s.id, s.color, s.x, s.y, s.z, s.radius].join('|')).join(';') + '#' + sc.bodies.map((b) => [b.id, b.systemId, b.color, b.size, b.orbit.radius, b.orbit.angle, b.orbit.incl, b.orbit.node].join('|')).join(';')

/** Three.js scene engine. Knows nothing about React, storage or the data model beyond Scene (read-only). */
export class Engine {
  private r!: THREE.WebGLRenderer; private sc = new THREE.Scene(); private cam: THREE.PerspectiveCamera; private ctl: OrbitControls; private tc: TransformControls
  private proxy = new THREE.Object3D(); private root = new THREE.Group(); private bgGroup = new THREE.Group(); private el: HTMLElement; private canvas: HTMLCanvasElement; private labelLayer = document.createElement('div')
  private data: Scene | null = null; private sig = ''; private planets: THREE.Mesh[] = []; private planetBySys = new Map<string, THREE.Mesh>(); private extras = new Map<string, THREE.Object3D[]>()
  private bodies: THREE.InstancedMesh | null = null; private bodyIds: string[] = []; private pos = new Float32Array(0); private bodySys: number[] = []; private sysIdx = new Map<string, number>()
  private sel: Sel = null; private selMesh: THREE.Mesh; private hover: Sel = null; private mode: 'navigate' | 'move' = 'navigate'
  private t = 0; private speed = 1; private motion = true; private reduced = false; private frozen = new Map<string, number>(); private dragSys: string | null = null
  private dirty = true; private raf = 0; private last = 0; private tween: any = null; private running = true; private lost = false
  private frames = 0; private fpsT = 0; private fps = 0; private ro: ResizeObserver; private dummy = new THREE.Object3D(); private ray = new THREE.Raycaster(); private bgImg: THREE.Texture | null = null
  private labels: HTMLElement[] = []; private sysLabels = new Map<string, HTMLElement>(); private down: { x: number; y: number; t: number } | null = null; private lastSettings: Settings | null = null
  private over = new Map<string, Vec3>() // live drag preview; the data model is never mutated here

  constructor(container: HTMLElement, private ev: EngineEvents) {
    this.el = container; this.canvas = document.createElement('canvas'); this.canvas.tabIndex = 0; this.canvas.className = 'm-canvas'; this.canvas.setAttribute('aria-label', '3D space')
    container.append(this.canvas, this.labelLayer); this.labelLayer.className = 'm-labels'
    this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !(COARSE && (navigator.hardwareConcurrency || 4) <= 4), powerPreference: 'high-performance' }) // throws if WebGL is unavailable
    this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.r.outputColorSpace = THREE.SRGBColorSpace
    this.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 8000); this.cam.position.set(0, 40, 90)
    this.sc.add(this.bgGroup, this.root, this.proxy, new THREE.AmbientLight(0xffffff, 0.55), new THREE.HemisphereLight(0xaec6ff, 0x1a1030, 0.5))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(60, 90, 40); this.sc.add(sun)
    this.ctl = new OrbitControls(this.cam, this.canvas); this.ctl.enableDamping = true; this.ctl.dampingFactor = 0.08; this.ctl.maxDistance = 3000; this.ctl.minDistance = 2
    this.ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }; this.ctl.listenToKeyEvents(this.canvas)
    this.ctl.addEventListener('end', () => this.emitCam()); this.ctl.addEventListener('change', () => (this.dirty = true))
    this.tc = new TransformControls(this.cam, this.canvas); this.tc.setMode('translate'); this.tc.setSize(0.9); this.sc.add(this.tc.getHelper()); this.tc.attach(this.proxy); this.tc.getHelper().visible = false; this.tc.enabled = false
    this.tc.addEventListener('dragging-changed', (e: any) => { this.ctl.enabled = !e.value; if (this.sel?.kind === 'system') { this.dragSys = e.value ? this.sel.id : null; if (!e.value) this.ev.onSystemMoved(this.sel.id, this.proxy.position.toArray() as Vec3, true) } this.dirty = true })
    this.tc.addEventListener('objectChange', () => { if (this.sel?.kind === 'system') { const p = this.proxy.position.toArray() as Vec3; this.moveSystem(this.sel.id, p); this.ev.onSystemMoved(this.sel.id, p, false) } })
    this.selMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.9, depthWrite: false })); this.selMesh.visible = false; this.sc.add(this.selMesh)
    const c = this.canvas; c.addEventListener('pointerdown', this.onDown); c.addEventListener('pointerup', this.onUp); c.addEventListener('pointermove', this.onMove)
    c.addEventListener('webglcontextlost', this.onLost); c.addEventListener('webglcontextrestored', this.onRestored)
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize(); this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.last = performance.now(); this.loop()
  }
  // ---------- public API ----------
  setData(sc: Scene) {
    const sig = sigOf(sc); const prev = this.data; this.data = sc
    if (sig !== this.sig || !prev) { this.sig = sig; this.build() } else this.dirty = true
    this.syncSelection()
  }
  setSettings(s: Settings) { this.lastSettings = s; this.motion = s.motion.enabled; this.speed = s.motion.speed; this.applyBackground(s); this.dirty = true }
  setReduced(v: boolean) { this.reduced = v }
  setSelection(sel: Sel) {
    if (sel?.kind === 'body') this.frozen.set(sel.id, this.t); // selected objects stop moving so they are easy to interact with
    if (this.sel?.kind === 'body' && this.sel.id !== sel?.id) this.frozen.delete(this.sel.id)
    this.sel = sel; this.syncSelection(); this.dirty = true
  }
  setMode(m: 'navigate' | 'move') { this.mode = m; this.syncSelection() }
  setCamera(pos: Vec3, target: Vec3) { this.cam.position.set(...pos); this.ctl.target.set(...target); this.ctl.update(); this.dirty = true }
  setBackgroundImage(url: string | null) {
    this.bgImg?.dispose(); this.bgImg = null; if (!url) { this.sc.background = null; this.applyBackground(this.lastSettings); return }
    new THREE.TextureLoader().load(url, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; this.bgImg = tx; this.sc.background = tx; this.dirty = true }, undefined, () => this.setBackgroundImage(null))
  }
  viewAll(instant = false) {
    if (!this.data?.systems.length) return this.flyTo([0, 40, 90], [0, 0, 0], true)
    const box = new THREE.Box3(); for (const s of this.data.systems) { const e = this.ext(s.id); box.expandByPoint(new THREE.Vector3(s.x - e, s.y - e, s.z - e)); box.expandByPoint(new THREE.Vector3(s.x + e, s.y + e, s.z + e)) }
    const sph = box.getBoundingSphere(new THREE.Sphere()), vf = (this.cam.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * this.cam.aspect), d = Math.max(30, (sph.radius / Math.tan(Math.min(vf, hf))) * 1.12) // fit in the narrower of the two fields of view (portrait phones)
    const dir = this.cam.position.clone().sub(this.ctl.target); if (dir.lengthSq() < 1e-6) dir.set(0, 0.5, 1); dir.normalize(); if (Math.abs(dir.y) > 0.95) dir.set(0, 0.6, 0.8).normalize()
    this.flyTo(sph.center.clone().add(dir.multiplyScalar(d)).toArray() as Vec3, sph.center.toArray() as Vec3, instant)
  }
  focus(sel: Sel, instant = false) {
    if (!sel || !this.data) return
    const dir = this.cam.position.clone().sub(this.ctl.target).normalize()
    if (sel.kind === 'system') { const s = this.data.systems.find((x) => x.id === sel.id); if (!s) return; const t = new THREE.Vector3(s.x, s.y, s.z); this.flyTo(t.clone().add(dir.multiplyScalar(this.ext(s.id) * 2.6 + 6)).toArray() as Vec3, t.toArray() as Vec3, instant) }
    else { const i = this.bodyIds.indexOf(sel.id); if (i < 0) return; const t = new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); this.flyTo(t.clone().add(dir.multiplyScalar(9)).toArray() as Vec3, t.toArray() as Vec3, instant) }
  }
  /** Screen position (client px) of an object — used for accessibility hooks and tests. */
  screenPos(sel: NonNullable<Sel>) {
    const v = new THREE.Vector3(); if (sel.kind === 'body') { const i = this.bodyIds.indexOf(sel.id); if (i < 0) return null; v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]) }
    else { const s = this.data?.systems.find((x) => x.id === sel.id); if (!s) return null; const o = this.over.get(s.id); v.set(o?.[0] ?? s.x, o?.[1] ?? s.y, o?.[2] ?? s.z) }
    v.project(this.cam); const rc = this.canvas.getBoundingClientRect(); return { x: rc.left + ((v.x + 1) / 2) * rc.width, y: rc.top + ((1 - v.y) / 2) * rc.height, visible: v.z < 1 }
  }
  stats() { return { fps: this.fps, scale: +this.pr.toFixed(2), bodies: this.bodyIds.length, systems: this.planets.length, lost: this.lost } }
  snapshot() { this.r.render(this.sc, this.cam); return this.canvas.toDataURL('image/png') }
  dispose() {
    cancelAnimationFrame(this.raf); this.running = false; this.ro.disconnect(); this.ctl.dispose(); this.tc.dispose(); this.clear(); this.bgImg?.dispose()
    this.bgGroup.children.forEach((o) => { (o as any).geometry?.dispose(); (o as any).material?.dispose?.() }); this.r.dispose(); this.r.forceContextLoss(); this.canvas.remove(); this.labelLayer.remove()
  }
  // ---------- internals ----------
  private ext = (id: string) => { const s = this.data!; return Math.max(s.systems.find((x) => x.id === id)?.radius ?? 2, ...s.bodies.filter((b) => b.systemId === id).map((b) => b.orbit.radius)) + 1 }
  private inset = 0
  /** Reserves screen space (e.g. a bottom sheet on phones) so the scene is centered in the visible part. */
  setInsets(bottom: number) { this.inset = Math.max(0, bottom); this.resize() }
  private resize() {
    const w = this.el.clientWidth || 300, h = this.el.clientHeight || 200; this.r.setSize(w, h, false); this.cam.aspect = w / h
    if (this.inset > 0 && this.inset < h * 0.8) this.cam.setViewOffset(w, h, 0, this.inset / 2, w, h); else this.cam.clearViewOffset()
    this.cam.updateProjectionMatrix(); this.dirty = true
  }
  private emitCam() { this.ev.onCamera({ pos: this.cam.position.toArray() as Vec3, target: this.ctl.target.toArray() as Vec3 }) }
  private flyTo(pos: Vec3, target: Vec3, instant = false) {
    if (instant || this.reduced) { this.tween = null; this.setCamera(pos, target); this.emitCam(); return }
    this.tween = { t0: performance.now(), dur: 700, p0: this.cam.position.clone(), t1: this.ctl.target.clone(), p: new THREE.Vector3(...pos), tg: new THREE.Vector3(...target) }
  }
  private clear() {
    for (const m of this.planets) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
    for (const list of this.extras.values()) for (const o of list) { (o as any).geometry?.dispose(); (o as any).material?.dispose() }
    this.root.clear(); this.planets = []; this.planetBySys.clear(); this.extras.clear(); if (this.bodies) { this.bodies.geometry.dispose(); (this.bodies.material as THREE.Material).dispose(); this.bodies = null }
    this.labelLayer.replaceChildren(); this.labels = []; this.sysLabels.clear()
  }
  private mkLabel(cls: string) { const e = document.createElement('div'); e.className = 'm-lbl ' + cls; e.dir = 'auto'; this.labelLayer.append(e); return e }
  private build() {
    this.clear(); this.over.clear(); const d = this.data!, root = this.root
    const pg = new THREE.SphereGeometry(1, 48, 32)
    d.systems.forEach((s, i) => {
      const col = toColor(s.color), m = new THREE.Mesh(pg.clone(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.05, emissive: col, emissiveIntensity: 0.1 }))
      m.position.set(s.x, s.y, s.z); m.scale.setScalar(s.radius); m.userData.sysId = s.id; root.add(m); this.planets.push(m); this.planetBySys.set(s.id, m); this.sysIdx.set(s.id, i)
      const extra: THREE.Object3D[] = [], e = this.ext(s.id)
      for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0]] as const) { // subtle boundary: two faint great circles instead of a dense mesh
        const pts: number[] = []; for (let a = 0; a < 128; a++) pts.push(Math.cos((a / 128) * 6.2832) * e, 0, Math.sin((a / 128) * 6.2832) * e)
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        const circ = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.14, depthWrite: false })); circ.position.copy(m.position); circ.rotation.set(rot[0], rot[1], rot[2]); root.add(circ); extra.push(circ) }
      const seen = new Set<string>()
      for (const b of d.bodies) if (b.systemId === s.id) { const k = b.orbit.radius.toFixed(3); if (seen.has(k)) continue; seen.add(k)
        const pts: number[] = []; for (let a = 0; a < 96; a++) pts.push(Math.cos((a / 96) * 6.2832) * b.orbit.radius, 0, Math.sin((a / 96) * 6.2832) * b.orbit.radius)
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
        const ring = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false })); ring.position.copy(m.position); ring.rotation.set(b.orbit.incl, b.orbit.node, 0, 'YXZ'); root.add(ring); extra.push(ring) }
      this.extras.set(s.id, extra); this.sysLabels.set(s.id, this.mkLabel('sys'))
    })
    pg.dispose()
    const n = d.bodies.length; this.bodyIds = d.bodies.map((b) => b.id); this.pos = new Float32Array(n * 3); this.bodySys = d.bodies.map((b) => this.sysIdx.get(b.systemId) ?? 0)
    if (n) { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }), n); im.frustumCulled = false
      d.bodies.forEach((b, i) => im.setColorAt(i, toColor(b.color))); if (im.instanceColor) im.instanceColor.needsUpdate = true; root.add(im); this.bodies = im }
    for (let i = 0; i < LABELS; i++) this.labels.push(this.mkLabel('body'))
    this.updateBodies(); this.dirty = true
  }
  private moveSystem(id: string, p: Vec3) {
    const m = this.planetBySys.get(id); if (!m) return; m.position.set(...p); for (const o of this.extras.get(id) || []) o.position.set(...p)
    this.over.set(id, p)
    this.updateBodies(); this.dirty = true
  }
  private updateBodies() {
    const d = this.data; if (!d || !this.bodies) return
    for (let i = 0; i < d.bodies.length; i++) {
      const b = d.bodies[i], s0 = d.systems[this.bodySys[i]]; if (!s0) continue; const ov = this.over.get(s0.id), s = ov ? { x: ov[0], y: ov[1], z: ov[2] } : s0
      const fz = this.frozen.get(b.id) ?? (this.dragSys === b.systemId ? this.t : undefined)
      const p = bodyPosition(s, b.orbit, fz ?? this.t, this.speed); this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1]; this.pos[i * 3 + 2] = p[2]
      this.dummy.position.set(p[0], p[1], p[2]); this.dummy.scale.setScalar(b.size); this.dummy.updateMatrix(); this.bodies.setMatrixAt(i, this.dummy.matrix)
    }
    this.bodies.instanceMatrix.needsUpdate = true
  }
  private syncSelection() {
    const d = this.data, s = this.sel; this.selMesh.visible = false; this.tc.getHelper().visible = false; this.tc.enabled = false
    if (!d || !s) return
    if (s.kind === 'system') { const sys = d.systems.find((x) => x.id === s.id); if (!sys) return; this.proxy.position.set(sys.x, sys.y, sys.z)
      if (this.mode === 'move') { this.tc.getHelper().visible = true; this.tc.enabled = true } }
    this.dirty = true
  }
  private applyBackground(s: Settings | null) {
    if (!s) return; const bg = s.background
    for (const o of [...this.bgGroup.children]) { this.bgGroup.remove(o); (o as any).geometry?.dispose(); const m = (o as any).material; m?.map?.dispose?.(); m?.dispose?.() }
    if (!this.bgImg) this.sc.background = toColor(bg.color)
    if (bg.preset === 'black') return
    const n = Math.round(300 + bg.starDensity * 2600), a = new Float32Array(n * 3), col = new Float32Array(n * 3); let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - u * u), R = 2500; a[i * 3] = R * r * Math.cos(th); a[i * 3 + 1] = R * u; a[i * 3 + 2] = R * r * Math.sin(th); const v = 0.45 + rnd() * 0.55; col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = Math.min(1, v + 0.1) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.bgGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.2 + bg.effects * 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55 + bg.effects * 0.4, depthWrite: false })))
    if (bg.preset === 'nebula' && !this.bgImg) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d')!; x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 1024, 512)
      const blobs = [['#3b4fd8', 0.2, 0.4], ['#7a3fd0', 0.55, 0.3], ['#1f9cc0', 0.8, 0.6], ['#c04a8a', 0.35, 0.7]]
      for (const [colr, px, py] of blobs as any) { const gr = x.createRadialGradient(px * 1024, py * 512, 10, px * 1024, py * 512, 260); gr.addColorStop(0, colr + 'aa'); gr.addColorStop(1, colr + '00'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 512) }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace
      this.bgGroup.add(new THREE.Mesh(new THREE.SphereGeometry(2800, 32, 16), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide, transparent: true, opacity: 0.15 + bg.effects * 0.55, depthWrite: false })))
    }
  }
  // ---------- input ----------
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() } }
  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null; if (!d || this.dragSys) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 500) return // a drag is camera navigation, never a selection
    this.ev.onPick(this.pick(e.clientX, e.clientY))
  }
  private hoverRaf = 0
  private onMove = (e: PointerEvent) => {
    if (this.down || this.hoverRaf) return
    this.hoverRaf = requestAnimationFrame(() => { this.hoverRaf = 0; const h = this.pick(e.clientX, e.clientY); if (h?.id !== this.hover?.id) { this.hover = h; this.canvas.style.cursor = h ? 'pointer' : ''; this.dirty = true } })
  }
  private pick(cx: number, cy: number): Sel {
    const rc = this.canvas.getBoundingClientRect(), x = cx - rc.left, y = cy - rc.top, w = rc.width, h = rc.height, v = new THREE.Vector3(); let best: { id: string; kind: 'body' | 'system'; z: number } | null = null
    const fovK = h / 2 / Math.tan((this.cam.fov * Math.PI) / 360); this.cam.updateMatrixWorld()
    for (let i = 0; i < this.bodyIds.length; i++) {
      v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); const dist = v.distanceTo(this.cam.position); v.project(this.cam); if (v.z > 1 || v.z < -1) continue
      const sx = ((v.x + 1) / 2) * w, sy = ((1 - v.y) / 2) * h, rad = Math.max(COARSE ? 18 : 9, (this.data!.bodies[i].size * fovK) / dist + (COARSE ? 8 : 4))
      if (Math.hypot(sx - x, sy - y) <= rad && (!best || dist < best.z)) best = { id: this.bodyIds[i], kind: 'body', z: dist }
    }
    this.ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), this.cam); const hit = this.ray.intersectObjects(this.planets, false)[0]
    if (hit && (!best || hit.distance < best.z)) best = { id: hit.object.userData.sysId, kind: 'system', z: hit.distance }
    return best ? { kind: best.kind, id: best.id } : null
  }
  private onLost = (e: Event) => { e.preventDefault(); this.lost = true; this.ev.onLost() }
  private onRestored = () => { this.lost = false; this.sig = ''; if (this.data) this.setData(this.data); if (this.lastSettings) this.applyBackground(this.lastSettings); this.ev.onRestored() }
  // ---------- loop ----------
  private loop = () => {
    if (!this.running) return; this.raf = requestAnimationFrame(this.loop)
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now
    if (this.lost) return
    let active = this.dirty
    if (this.tween) { const k = Math.min(1, (now - this.tween.t0) / this.tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.cam.position.lerpVectors(this.tween.p0, this.tween.p, e); this.ctl.target.lerpVectors(this.tween.t1, this.tween.tg, e); if (k >= 1) { this.tween = null; this.emitCam() } active = true }
    if (this.motion && !this.reduced) { this.t += dt; this.updateBodies(); active = true }
    if (this.ctl.update()) active = true
    if (!active) return
    this.dirty = false; this.updateLabels(); this.r.render(this.sc, this.cam)
    this.frames++; if (now - this.fpsT > 1000) { this.fps = Math.round((this.frames * 1000) / (now - this.fpsT)); this.frames = 0; this.fpsT = now; this.adapt() }
  }
  private pr = Math.min(devicePixelRatio || 1, 2); private lowN = 0; private highN = 0
  /** Adaptive resolution: weak GPUs (or software rendering) automatically render at lower resolution to stay responsive. */
  private adapt() {
    if (this.fps < 24 && (this.motion || this.tween)) { this.highN = 0; if (++this.lowN >= 2 && this.pr > 0.5) { this.pr = Math.max(0.5, this.pr * 0.8); this.r.setPixelRatio(this.pr); this.resize(); this.lowN = 0 } }
    else if (this.fps > 56 && this.pr < Math.min(devicePixelRatio || 1, 2)) { this.lowN = 0; if (++this.highN >= 5) { this.pr = Math.min(Math.min(devicePixelRatio || 1, 2), this.pr * 1.15); this.r.setPixelRatio(this.pr); this.resize(); this.highN = 0 } } else { this.lowN = 0; this.highN = 0 }
  }
  private updateLabels() {
    const d = this.data; if (!d) return; const w = this.el.clientWidth, h = this.el.clientHeight, v = new THREE.Vector3()
    const place = (el: HTMLElement, x: number, y: number, z: number, text: string, on: boolean, fav?: string | null) => {
      v.set(x, y, z).project(this.cam); if (!on || v.z > 1 || v.z < -1) { el.style.display = 'none'; return }
      el.style.display = ''; el.style.transform = `translate(-50%,-110%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px)`; if (el.dataset.t !== text) { el.dataset.t = text; el.textContent = text }
    }
    d.systems.forEach((s0) => { const ov = this.over.get(s0.id), s = ov ? { ...s0, x: ov[0], y: ov[1], z: ov[2] } : s0; const el = this.sysLabels.get(s.id); if (el) { place(el, s.x, s.y + s.radius + 0.4, s.z, s.inbox ? this.inboxName : s.name, true); el.classList.toggle('on', this.sel?.id === s.id || this.hover?.id === s.id) } })
    const cp = this.cam.position, want = new Set<number>(); const idx = (id?: string) => (id ? this.bodyIds.indexOf(id) : -1)
    ;[idx(this.sel?.kind === 'body' ? this.sel.id : undefined), idx(this.hover?.kind === 'body' ? this.hover.id : undefined)].forEach((i) => i >= 0 && want.add(i))
    const near = this.bodyIds.map((_, i) => ({ i, d: (this.pos[i * 3] - cp.x) ** 2 + (this.pos[i * 3 + 1] - cp.y) ** 2 + (this.pos[i * 3 + 2] - cp.z) ** 2 })).filter((o) => o.d < 40 * 40).sort((a, b) => a.d - b.d)
    for (const o of near) { if (want.size >= this.labels.length) break; want.add(o.i) }
    const arr = [...want]; this.labels.forEach((el, k) => { const i = arr[k]; if (i === undefined) { el.style.display = 'none'; return }
      const b = d.bodies[i]; place(el, this.pos[i * 3], this.pos[i * 3 + 1] + b.size + 0.2, this.pos[i * 3 + 2], b.title, true); el.classList.toggle('on', this.sel?.id === b.id || this.hover?.id === b.id) })
    if (this.sel?.kind === 'body') { const i = idx(this.sel.id); if (i >= 0) { this.selMesh.visible = true; this.selMesh.position.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); this.selMesh.scale.setScalar(d.bodies[i].size * 1.45) } }
    else if (this.sel?.kind === 'system') { const s0 = d.systems.find((x) => x.id === this.sel!.id), ov = s0 && this.over.get(s0.id), s = s0 && (ov ? { ...s0, x: ov[0], y: ov[1], z: ov[2] } : s0); if (s) { this.selMesh.visible = true; this.selMesh.position.set(s.x, s.y, s.z); this.selMesh.scale.setScalar(s.radius * 1.18) } }
  }
  inboxName = 'Unsorted'
}
