// NOTE: this file was recovered from a build artifact after an accidental overwrite; behaviour is identical but local variable names are short.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { toColor } from './color'
import { IconAtlas } from './icons'
import { buildBackground, glowSprite } from './backgrounds'
import { bodyPosition } from '../model/orbit'
import type { Vec3 } from '../model/types'

export type Sel = { kind: 'body' | 'system'; id: string } | null
export interface EngineEvents {
  onPick(sel: Sel): void
  onDouble(sel: NonNullable<Sel>): void
  onBodyDrop(bodyId: string, systemId: string | null): void
  onSystemMoved(id: string, pos: Vec3, final: boolean): void
  onCamera(c: { pos: Vec3; target: Vec3 }): void
  onLost(): void
  onRestored(): void
}
const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const t0 = COARSE ? 40 : 90, LABELS = COARSE ? 14 : 28
const n0 = "vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);"
const i0 = (t: any) => [t.color, t.title, t.url, (t.favicon || '').length, t.glow?.color, t.glow?.intensity].join('|')
const sC = (t: any) => t.systems.map((e: any) => e.id).join(';') + '#' + t.bodies.map((e: any) => e.id + '|' + e.systemId).join(';')

export class Engine {
    [key: string]: any;
    constructor(e: any, n: EngineEvents){
        this.ev = n;
        this.sc = new THREE.Scene();
        this.proxy = new THREE.Object3D();
        this.root = new THREE.Group();
        this.bgGroup = new THREE.Group();
        this.labelLayer = document.createElement("div");
        this.data = null;
        this.struct = "";
        this.planetGeo = new THREE.SphereGeometry(1, 48, 32);
        this.planets = [];
        this.planetBySys = new Map();
        this.extras = new Map();
        this.sysGlow = new Map();
        this.sysKeys = new Map();
        this.bodies = null;
        this.icons = null;
        this.halo = null;
        this.atlas = null;
        this.glowAttr = null;
        this.bodyIds = [];
        this.bodyKeys = [];
        this.glowIdx = [];
        this.pos = new Float32Array(0);
        this.bodySys = [];
        this.sysIdx = new Map();
        this.sel = null;
        this.hover = null;
        this.mode = "navigate";
        this.t = 0;
        this.bgT = 0;
        this.speed = 1;
        this.motion = true;
        this.reduced = false;
        this.frozen = new Map();
        this.dragSys = null;
        this.dirty = true;
        this.raf = 0;
        this.last = 0;
        this.tween = null;
        this.running = true;
        this.lost = false;
        this.frames = 0;
        this.fpsT = 0;
        this.fps = 0;
        this.dummy = new THREE.Object3D();
        this.ray = new THREE.Raycaster();
        this.bgImg = null;
        this.bg = null;
        this.bgKey = "";
        this.labels = [];
        this.sysLabels = new Map();
        this.down = null;
        this.lastSettings = null;
        this.bodyOver = new Map();
        this.over = new Map();
        this.bodyOver = new Map();
        this.drag = null;
        this.lastTap = null;
        this.showIcons = true;
        this.labelMode = "near";
        this.inset = 0;
        this.pr = Math.min(devicePixelRatio || 1, 2);
        this.lowN = 0;
        this.highN = 0;
        this.hoverRaf = 0;
        this.inboxName = "Unsorted";
        this.ext = (o)=>{
            const data = this.data;
            return Math.max(data.systems.find((c)=>c.id === o)?.radius ?? 2, ...data.bodies.filter((c)=>c.systemId === o).map((c)=>c.orbit.radius)) + 1;
        };
        this.onDown = (o)=>{
            this.down = {
                x: o.clientX,
                y: o.clientY,
                t: performance.now()
            };
            if (this.mode === "move" && this.sel?.kind === "body") {
                const l = this.bodyIds.indexOf(this.sel.id);
                if (l >= 0 && this.nearBody(l, o.clientX, o.clientY)) {
                    const c = this.sel;
                    const u = l;
                    const f = new THREE.Vector3(this.pos[u * 3], this.pos[u * 3 + 1], this.pos[u * 3 + 2]);
                    const h = this.cam.getWorldDirection(new THREE.Vector3());
                    this.drag = {
                        id: c.id,
                        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(h, f),
                        target: null,
                        moved: false
                    };
                    this.ctl.enabled = false;
                    try {
                        this.canvas.setPointerCapture(o.pointerId);
                    } catch  {}
                }
            }
        };
        this.onUp = (o)=>{
            if (this.drag) {
                const u = this.drag;
                this.drag = null;
                this.down = null;
                this.bodyOver.delete(u.id);
                this.dropMesh.visible = false;
                this.ctl.enabled = !this.dragSys;
                try {
                    this.canvas.releasePointerCapture(o.pointerId);
                } catch  {}
                this.updateBodies();
                this.dirty = true;
                if (u.moved) {
                    this.ev.onBodyDrop(u.id, u.target);
                }
                return;
            }
            const down = this.down;
            this.down = null;
            if (!down || this.dragSys || Math.hypot(o.clientX - down.x, o.clientY - down.y) > 5 || performance.now() - down.t > 500) {
                return;
            }
            const l = this.pick(o.clientX, o.clientY);
            const t = performance.now();
            if (l && this.lastTap && this.lastTap.id === l.id && t - this.lastTap.t < 380) {
                this.lastTap = null;
                if (l.kind === "body") {
                    const u = this.bodyIds.indexOf(l.id);
                    if (u >= 0 && this.projRadius(u) < 11) {
                        this.ev.onDouble({
                            kind: "system",
                            id: this.data.bodies[u].systemId
                        });
                        return;
                    }
                }
                this.ev.onDouble(l);
                return;
            }
            this.lastTap = {
                id: l?.id ?? "",
                t
            };
            this.ev.onPick(l);
        };
        this.onMove = (o)=>{
            if (this.drag) {
                const l = this.canvas.getBoundingClientRect();
                const c = new THREE.Vector3();
                this.ray.setFromCamera(new THREE.Vector2((o.clientX - l.left) / l.width * 2 - 1, -((o.clientY - l.top) / l.height) * 2 + 1), this.cam);
                if (this.ray.ray.intersectPlane(this.drag.plane, c)) {
                    this.bodyOver.set(this.drag.id, c.toArray());
                    this.drag.moved = true;
                    let u = null;
                    let f = 1;
                    for (const p of this.data.systems){
                        const m = this.over.get(p.id);
                        const y = new THREE.Vector3(m?.[0] ?? p.x, m?.[1] ?? p.y, m?.[2] ?? p.z).distanceTo(c) / (this.ext(p.id) + 2);
                        if (y < f) {
                            f = y;
                            u = p;
                        }
                    }
                    const h = this.data.bodies.find((p)=>p.id === this.drag.id)?.systemId;
                    this.drag.target = u && u.id !== h ? u.id : null;
                    if (this.drag.target && u) {
                        const p = this.planetBySys.get(u.id);
                        this.dropMesh.position.copy(p.position);
                        this.dropMesh.scale.setScalar(this.ext(u.id) * 0.98);
                        this.dropMesh.visible = true;
                    } else {
                        this.dropMesh.visible = false;
                    }
                    this.updateBodies();
                    this.dirty = true;
                }
                return;
            }
            if (!(this.down || this.hoverRaf)) {
                this.hoverRaf = requestAnimationFrame(()=>{
                    this.hoverRaf = 0;
                    const l = this.pick(o.clientX, o.clientY);
                    if (l?.id !== this.hover?.id) {
                        this.hover = l;
                        this.canvas.style.cursor = l ? "pointer" : "";
                        this.dirty = true;
                    }
                });
            }
        };
        this.onLost = (o)=>{
            o.preventDefault();
            this.lost = true;
            this.ev.onLost();
        };
        this.onRestored = ()=>{
            this.lost = false;
            this.struct = "";
            this.bgKey = "";
            if (this.data) {
                this.setData(this.data);
            }
            if (this.lastSettings) {
                this.setSettings(this.lastSettings);
            }
            this.ev.onRestored();
        };
        this.loop = ()=>{
            var c;
            if (!this.running) {
                return;
            }
            this.raf = requestAnimationFrame(this.loop);
            const o = performance.now();
            const a = Math.min(0.1, (o - this.last) / 1000);
            this.last = o;
            if (this.lost) {
                return;
            }
            let dirty = this.dirty;
            if (this.tween) {
                const u = Math.min(1, (o - this.tween.t0) / this.tween.dur);
                const f = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
                this.cam.position.lerpVectors(this.tween.p0, this.tween.p, f);
                this.ctl.target.lerpVectors(this.tween.t1, this.tween.tg, f);
                if (u >= 1) {
                    this.tween = null;
                    this.emitCam();
                }
                dirty = true;
            }
            if (this.motion && !this.reduced) {
                this.t += a;
                this.bgT += a;
                this.updateBodies();
                if ((c = this.bg) != null) {
                    c.update(this.bgT, a);
                }
                dirty = true;
            }
            if (this.ctl.update()) {
                dirty = true;
            }
            if (dirty) {
                this.dirty = false;
                this.bgGroup.position.copy(this.cam.position);
                this.updateLabels();
                this.r.render(this.sc, this.cam);
                this.frames++;
                if (o - this.fpsT > 1000) {
                    this.fps = Math.round(this.frames * 1000 / (o - this.fpsT));
                    this.frames = 0;
                    this.fpsT = o;
                    this.adapt();
                }
            }
        };
        this.el = e;
        this.canvas = document.createElement("canvas");
        this.canvas.tabIndex = 0;
        this.canvas.className = "m-canvas";
        this.canvas.setAttribute("aria-label", "3D space");
        e.append(this.canvas, this.labelLayer);
        this.labelLayer.className = "m-labels";
        this.r = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: !(COARSE && (navigator.hardwareConcurrency || 4) <= 4),
            powerPreference: "high-performance"
        });
        this.r.setPixelRatio(this.pr);
        this.r.outputColorSpace = THREE.SRGBColorSpace;
        this.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 8000);
        this.cam.position.set(0, 40, 90);
        this.sc.add(this.bgGroup, this.root, this.proxy, new THREE.AmbientLight(16777215, 0.55), new THREE.HemisphereLight(11454207, 1708080, 0.5));
        const i = new THREE.DirectionalLight(16777215, 2.2);
        i.position.set(60, 90, 40);
        this.sc.add(i);
        this.ctl = new OrbitControls(this.cam, this.canvas);
        this.ctl.enableDamping = true;
        this.ctl.dampingFactor = 0.08;
        this.ctl.maxDistance = 3000;
        this.ctl.minDistance = 2;
        this.ctl.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        this.ctl.listenToKeyEvents(this.canvas);
        this.ctl.addEventListener("end", ()=>this.emitCam());
        this.ctl.addEventListener("change", ()=>this.dirty = true);
        this.tc = new TransformControls(this.cam, this.canvas);
        this.tc.setMode("translate");
        this.tc.setSize(0.9);
        this.sc.add(this.tc.getHelper());
        this.tc.attach(this.proxy);
        this.tc.getHelper().visible = false;
        this.tc.enabled = false;
        this.tc.addEventListener("dragging-changed", (o)=>{
            this.ctl.enabled = !o.value;
            if (this.sel?.kind === "system") {
                this.dragSys = o.value ? this.sel.id : null;
                if (!o.value) {
                    this.ev.onSystemMoved(this.sel.id, this.proxy.position.toArray(), true);
                }
            }
            this.dirty = true;
        });
        this.tc.addEventListener("objectChange", ()=>{
            if (this.sel?.kind === "system") {
                const a = this.proxy.position.toArray();
                this.moveSystem(this.sel.id, a);
                this.ev.onSystemMoved(this.sel.id, a, false);
            }
        });
        const r = (o)=>new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({
                color: o,
                wireframe: true,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            }));
        this.selMesh = r(16777215);
        this.dropMesh = r(4576949);
        this.selMesh.visible = this.dropMesh.visible = false;
        this.sc.add(this.selMesh, this.dropMesh);
        const s = this.canvas;
        s.addEventListener("pointerdown", this.onDown, true);
        s.addEventListener("pointerup", this.onUp);
        s.addEventListener("pointermove", this.onMove);
        s.addEventListener("webglcontextlost", this.onLost);
        s.addEventListener("webglcontextrestored", this.onRestored);
        this.ro = new ResizeObserver(()=>this.resize());
        this.ro.observe(e);
        this.resize();
        this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        for(let o = 0; o < t0; o++){
            this.labels.push(this.mkLabel("body"));
        }
        this.last = performance.now();
        this.loop();
    }
    setData(e) {
        const data = this.data;
        this.data = e;
        const i = sC(e);
        if (!data || i !== this.struct) {
            this.struct = i;
            this.build();
        } else {
            this.refresh();
        }
        this.syncSelection();
        this.dirty = true;
    }
    setSettings(e) {
        this.lastSettings = e;
        this.motion = e.motion.enabled;
        this.speed = e.motion.speed;
        this.showIcons = e.view?.icons !== false;
        this.labelMode = e.view?.labels ?? "near";
        if (this.icons) {
            this.icons.visible = this.showIcons;
        }
        const n = JSON.stringify(e.background) + (this.bgImg ? "i" : "");
        if (n !== this.bgKey) {
            this.bgKey = n;
            this.applyBackground(e);
        }
        this.dirty = true;
    }
    setReduced(e) {
        this.reduced = e;
    }
    setSelection(e) {
        if (e?.kind === "body") {
            this.frozen.set(e.id, this.t);
        }
        if (this.sel?.kind === "body" && this.sel.id !== e?.id) {
            this.frozen.delete(this.sel.id);
        }
        this.sel = e;
        this.syncSelection();
        this.dirty = true;
    }
    setMode(e) {
        this.mode = e;
        this.syncSelection();
    }
    setCamera(e, n) {
        this.cam.position.set(...e);
        this.ctl.target.set(...n);
        this.ctl.update();
        this.dirty = true;
    }
    setBackgroundImage(e) {
        this.bgImg?.dispose();
        this.bgImg = null;
        if (!e) {
            this.sc.background = null;
            this.bgKey = "";
            if (this.lastSettings) {
                this.setSettings(this.lastSettings);
            }
            return;
        }
        new THREE.TextureLoader().load(e, (i)=>{
            i.colorSpace = THREE.SRGBColorSpace;
            this.bgImg = i;
            this.sc.background = i;
            this.dirty = true;
        }, undefined, ()=>this.setBackgroundImage(null));
    }
    setInsets(e) {
        this.inset = Math.max(0, e);
        this.resize();
    }
    viewAll(e = false) {
        let l;
        if (!((l = this.data) != null && l.systems.length)) {
            return this.flyTo([
                0,
                40,
                90
            ], [
                0,
                0,
                0
            ], true);
        }
        const n = new THREE.Box3();
        for (const c of this.data.systems){
            const u = this.ext(c.id);
            n.expandByPoint(new THREE.Vector3(c.x - u, c.y - u, c.z - u));
            n.expandByPoint(new THREE.Vector3(c.x + u, c.y + u, c.z + u));
        }
        const i = n.getBoundingSphere(new THREE.Sphere());
        const r = this.cam.fov * Math.PI / 360;
        const s = Math.atan(Math.tan(r) * this.cam.aspect);
        const o = Math.max(30, i.radius / Math.tan(Math.min(r, s)) * 1.12);
        const a = this.cam.position.clone().sub(this.ctl.target);
        if (a.lengthSq() < 0.000001) {
            a.set(0, 0.5, 1);
        }
        a.normalize();
        if (Math.abs(a.y) > 0.95) {
            a.set(0, 0.6, 0.8).normalize();
        }
        this.flyTo(i.center.clone().add(a.multiplyScalar(o)).toArray(), i.center.toArray(), e);
    }
    focus(e, n = false) {
        if (!e || !this.data) {
            return;
        }
        const i = this.cam.position.clone().sub(this.ctl.target).normalize();
        if (e.kind === "system") {
            const r = this.data.systems.find((o)=>o.id === e.id);
            if (!r) {
                return;
            }
            const s = new THREE.Vector3(r.x, r.y, r.z);
            this.flyTo(s.clone().add(i.multiplyScalar(this.ext(r.id) * 2.6 + 6)).toArray(), s.toArray(), n);
        } else {
            const r = this.bodyIds.indexOf(e.id);
            if (r < 0) {
                return;
            }
            const s = new THREE.Vector3(this.pos[r * 3], this.pos[r * 3 + 1], this.pos[r * 3 + 2]);
            this.flyTo(s.clone().add(i.multiplyScalar(9 + this.data.bodies[r].size * 4)).toArray(), s.toArray(), n);
        }
    }
    screenPos(e) {
        const n = new THREE.Vector3();
        if (e.kind === "body") {
            const s = this.bodyIds.indexOf(e.id);
            if (s < 0) {
                return null;
            }
            n.set(this.pos[s * 3], this.pos[s * 3 + 1], this.pos[s * 3 + 2]);
        } else {
            const s = this.data?.systems.find((a)=>a.id === e.id);
            if (!s) {
                return null;
            }
            const o = this.over.get(s.id);
            n.set(o?.[0] ?? s.x, o?.[1] ?? s.y, o?.[2] ?? s.z);
        }
        n.project(this.cam);
        const i = this.canvas.getBoundingClientRect();
        return {
            x: i.left + (n.x + 1) / 2 * i.width,
            y: i.top + (1 - n.y) / 2 * i.height,
            visible: n.z < 1
        };
    }
    stats() {
        return {
            fps: this.fps,
            scale: +this.pr.toFixed(2),
            bodies: this.bodyIds.length,
            systems: this.planets.length,
            glowing: this.glowIdx.length,
            lost: this.lost
        };
    }
    snapshot() {
        this.r.render(this.sc, this.cam);
        return this.canvas.toDataURL("image/png");
    }
    dispose() {
        cancelAnimationFrame(this.raf);
        this.running = false;
        this.ro.disconnect();
        this.ctl.dispose();
        this.tc.dispose();
        this.clear();
        this.bgImg?.dispose();
        this.bg?.dispose();
        this.planetGeo.dispose();
        this.r.dispose();
        this.r.forceContextLoss();
        this.canvas.remove();
        this.labelLayer.remove();
    }
    resize() {
        const e = this.el.clientWidth || 300;
        const n = this.el.clientHeight || 200;
        this.r.setSize(e, n, false);
        this.cam.aspect = e / n;
        if (this.inset > 0 && this.inset < n * 0.8) {
            this.cam.setViewOffset(e, n, 0, this.inset / 2, e, n);
        } else {
            this.cam.clearViewOffset();
        }
        this.cam.updateProjectionMatrix();
        this.dirty = true;
    }
    emitCam() {
        this.ev.onCamera({
            pos: this.cam.position.toArray(),
            target: this.ctl.target.toArray()
        });
    }
    flyTo(e, n, i = false) {
        if (i || this.reduced) {
            this.tween = null;
            this.setCamera(e, n);
            this.emitCam();
            return;
        }
        this.tween = {
            t0: performance.now(),
            dur: 700,
            p0: this.cam.position.clone(),
            t1: this.ctl.target.clone(),
            p: new THREE.Vector3(...e),
            tg: new THREE.Vector3(...n)
        };
    }
    disposeObj(e) {
        let r;
        let s;
        e.geometry?.dispose?.();
        if (e.material) {
            e.material.map && e.material.map.name;
            if ((s = (r = e.material).dispose) != null) {
                s.call(r);
            }
        }
    }
    clear() {
        for (const n of this.planets){
            n.material.dispose();
        }
        for (const n of this.extras.values()){
            for (const i of n){
                this.disposeObj(i);
            }
        }
        for (const n of this.sysGlow.values()){
            n.material.dispose();
        }
        for (const n of [
            this.bodies,
            this.icons,
            this.halo
        ]){
            if (n) {
                n.geometry.dispose();
                n.material.dispose();
            }
        }
        this.atlas?.dispose();
        this.atlas = null;
        this.root.clear();
        this.planets = [];
        this.planetBySys.clear();
        this.extras.clear();
        this.sysGlow.clear();
        this.sysKeys.clear();
        this.bodies = this.icons = this.halo = null;
        this.glowAttr = null;
        for (const n of this.sysLabels.values()){
            n.remove();
        }
        this.sysLabels.clear();
    }
    mkLabel(e) {
        const n = document.createElement("div");
        n.className = `m-lbl ${e}`;
        n.dir = "auto";
        n.style.display = "none";
        this.labelLayer.append(n);
        return n;
    }
    orbitKeys() {
        const e = new Map();
        this.data.bodies.forEach((n)=>(e.get(n.systemId) || e.set(n.systemId, []).get(n.systemId)).push([
                n.orbit.radius,
                n.orbit.incl,
                n.orbit.node,
                n.orbit.ecc || 0
            ].map((i)=>i.toFixed(3)).join(",")));
        return e;
    }
    sysKey(e, n) {
        return [
            e.x,
            e.y,
            e.z,
            e.radius,
            e.color,
            e.glow?.color,
            e.glow?.intensity,
            (n.get(e.id) || []).join(";")
        ].join("|");
    }
    build() {
        this.clear();
        this.over.clear();
        this.bodyOver.clear();
        const data = this.data;
        const n = this.orbitKeys();
        data.systems.forEach((r, s)=>{
            const o = new THREE.Mesh(this.planetGeo, new THREE.MeshStandardMaterial({
                roughness: 0.65,
                metalness: 0.05
            }));
            o.userData.sysId = r.id;
            this.root.add(o);
            this.planets.push(o);
            this.planetBySys.set(r.id, o);
            this.sysIdx.set(r.id, s);
            this.applySystem(r);
            this.sysKeys.set(r.id, this.sysKey(r, n));
            this.sysLabels.set(r.id, this.mkLabel("sys"));
        });
        const length = data.bodies.length;
        this.bodyIds = data.bodies.map((r)=>r.id);
        this.pos = new Float32Array(length * 3);
        this.bodySys = data.bodies.map((r)=>this.sysIdx.get(r.systemId) ?? 0);
        this.bodyKeys = data.bodies.map(i0);
        if (length) {
            const r = new THREE.SphereGeometry(1, 24, 16);
            this.glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(length), 1);
            r.setAttribute("aGlow", this.glowAttr);
            const s = new THREE.MeshStandardMaterial({
                roughness: 0.5,
                metalness: 0.05
            });
            s.onBeforeCompile = (u)=>{
                u.vertexShader = u.vertexShader.replace("#include <common>", `#include <common>
attribute float aGlow;
varying float vGlow;`).replace("#include <begin_vertex>", `#include <begin_vertex>
vGlow = aGlow;`);
                u.fragmentShader = u.fragmentShader.replace("#include <common>", `#include <common>
varying float vGlow;`).replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.6;`);
            };
            const o = new THREE.InstancedMesh(r, s, length);
            o.frustumCulled = false;
            this.bodies = o;
            data.bodies.forEach((u, f)=>{
                o.setColorAt(f, toColor(u.color));
                this.glowAttr.setX(f, u.glow?.intensity || 0);
            });
            if (o.instanceColor) {
                o.instanceColor.needsUpdate = true;
            }
            this.atlas = new IconAtlas(length, COARSE);
            const a = new Float32Array(length * 2);
            data.bodies.forEach((u, f)=>{
                this.atlas.draw(f, u);
                const h = this.atlas.uv(f);
                a[f * 2] = h[0];
                a[f * 2 + 1] = h[1];
            });
            const l = new THREE.PlaneGeometry(2, 2);
            l.setAttribute("aCell", new THREE.InstancedBufferAttribute(a, 2));
            const c = new THREE.ShaderMaterial({
                uniforms: {
                    uAtlas: {
                        value: this.atlas.tex
                    },
                    uCell: {
                        value: this.atlas.cellUv
                    }
                },
                vertexShader: `attribute vec2 aCell; uniform float uCell; varying vec2 vUv; varying vec2 vL; varying float vOk;
          void main(){ vec3 c = instanceMatrix[3].xyz; float r = length(instanceMatrix[0].xyz); vec3 toCam = normalize(cameraPosition - c); ${n0}
            vec3 p = c + toCam * r * 0.9 + (right * position.x + up * position.y) * r * 0.97; vL = uv; vUv = aCell + vec2(uv.x, 1.0 - uv.y) * uCell; vOk = step(0.0, aCell.x); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
                fragmentShader: `uniform sampler2D uAtlas; varying vec2 vUv; varying vec2 vL; varying float vOk;
          void main(){ if (vOk < 0.5) discard; vec4 t = texture2D(uAtlas, vUv); if (t.a < 0.05) discard; float d = length(vL - 0.5) * 2.0; float spec = smoothstep(0.55, 0.0, length(vL - vec2(0.36, 0.68))) * 0.28;
            vec3 col = t.rgb * (1.0 - 0.34 * d * d) + spec; gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}`
            });
            this.icons = new THREE.InstancedMesh(l, c, length);
            this.icons.frustumCulled = false;
            this.icons.visible = this.showIcons;
            this.root.add(o, this.icons);
        }
        this.makeHalos();
        this.updateBodies();
    }
    makeHalos() {
        if (this.halo) {
            this.root.remove(this.halo);
            this.halo.geometry.dispose();
            this.halo.material.dispose();
            this.halo = null;
        }
        const data = this.data;
        this.glowIdx = [];
        data.bodies.forEach((a, l)=>{
            if ((a.glow?.intensity || 0) > 0) {
                this.glowIdx.push(l);
            }
        });
        const length = this.glowIdx.length;
        if (!length) {
            return;
        }
        const i = new THREE.PlaneGeometry(2, 2);
        const r = new Float32Array(length * 3);
        const s = new Float32Array(length);
        this.glowIdx.forEach((a, l)=>{
            const c = toColor(data.bodies[a].glow.color);
            r[l * 3] = c.r;
            r[l * 3 + 1] = c.g;
            r[l * 3 + 2] = c.b;
            s[l] = data.bodies[a].glow.intensity;
        });
        i.setAttribute("aColor", new THREE.InstancedBufferAttribute(r, 3));
        i.setAttribute("aGlow", new THREE.InstancedBufferAttribute(s, 1));
        const o = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `attribute vec3 aColor; attribute float aGlow; varying vec3 vC; varying float vG; varying vec2 vL;
        void main(){ vec3 c = instanceMatrix[3].xyz; float r = length(instanceMatrix[0].xyz); ${n0} vL = position.xy; vC = aColor; vG = aGlow; gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * r, 1.0); }`,
            fragmentShader: "varying vec3 vC; varying float vG; varying vec2 vL; void main(){ float d = length(vL); float a = pow(max(0.0, 1.0 - d), 2.2) * vG * 1.25; gl_FragColor = vec4(vC * a, a);\n#include <colorspace_fragment>\n}"
        });
        this.halo = new THREE.InstancedMesh(i, o, length);
        this.halo.frustumCulled = false;
        this.root.add(this.halo);
    }
    makeExtras(e, n, i) {
        const r = [];
        const s = this.ext(e.id);
        const o = (c, opacity, f)=>{
            const h = new THREE.BufferGeometry();
            h.setAttribute("position", new THREE.Float32BufferAttribute(c, 3));
            const p = new THREE.LineLoop(h, new THREE.LineBasicMaterial({
                color: n,
                transparent: true,
                opacity,
                depthWrite: false
            }));
            p.position.copy(i);
            p.rotation.copy(f);
            this.root.add(p);
            r.push(p);
        };
        for (const c of [
            0,
            Math.PI / 2
        ]){
            const u = [];
            for(let f = 0; f < 128; f++){
                u.push(Math.cos(f / 128 * 6.2832) * s, 0, Math.sin(f / 128 * 6.2832) * s);
            }
            o(u, 0.14, new THREE.Euler(c, 0, 0));
        }
        const a = new Set();
        let l = 0;
        for (const c of this.data.bodies){
            if (c.systemId !== e.id || l >= 40) {
                continue;
            }
            const u = c.orbit;
            const f = [
                u.radius,
                u.incl,
                u.node,
                u.ecc || 0
            ].map((m)=>m.toFixed(3)).join(",");
            if (a.has(f)) {
                continue;
            }
            a.add(f);
            l++;
            const h = u.radius * Math.sqrt(1 - (u.ecc || 0) ** 2);
            const p = [];
            for(let m = 0; m < 96; m++){
                p.push(Math.cos(m / 96 * 6.2832) * u.radius, 0, Math.sin(m / 96 * 6.2832) * h);
            }
            o(p, 0.2, new THREE.Euler(u.incl, u.node, 0, "YXZ"));
        }
        return r;
    }
    applySystem(e) {
        const n = this.planetBySys.get(e.id);
        const n_material = n.material;
        const r = toColor(e.color);
        const s = e.glow?.intensity || 0;
        n_material.color.copy(r);
        n_material.emissive.copy(toColor(e.glow?.color || e.color));
        n_material.emissiveIntensity = 0.1 + s * 1.6;
        n.position.set(e.x, e.y, e.z);
        n.scale.setScalar(e.radius);
        const o = this.sysGlow.get(e.id);
        if (o) {
            this.root.remove(o);
            o.material.dispose();
            this.sysGlow.delete(e.id);
        }
        if (s > 0) {
            const c = glowSprite(toColor(e.glow.color), e.radius * (3 + 7 * s), 0.25 + 0.75 * s);
            c.position.copy(n.position);
            this.root.add(c);
            this.sysGlow.set(e.id, c);
        }
        for (const c of this.extras.get(e.id) || []){
            this.root.remove(c);
            this.disposeObj(c);
        }
        this.extras.set(e.id, this.makeExtras(e, r, n.position));
    }
    refresh() {
        const data = this.data;
        const n = this.orbitKeys();
        this.bodyOver.clear();
        data.systems.forEach((r)=>{
            const s = this.sysKey(r, n);
            if (this.sysKeys.get(r.id) !== s) {
                this.sysKeys.set(r.id, s);
                this.over.delete(r.id);
                this.applySystem(r);
            }
        });
        let i = false;
        data.bodies.forEach((r, s)=>{
            var l;
            const o = i0(r);
            if (this.bodyKeys[s] !== o) {
                this.bodyKeys[s] = o;
                i = true;
                this.bodies.setColorAt(s, toColor(r.color));
                this.glowAttr.setX(s, r.glow?.intensity || 0);
                if ((l = this.atlas) != null) {
                    l.draw(s, r);
                }
            }
        });
        if (i) {
            if (this.bodies.instanceColor) {
                this.bodies.instanceColor.needsUpdate = true;
            }
            this.glowAttr.needsUpdate = true;
            this.makeHalos();
        }
    }
    moveSystem(e, n) {
        const i = this.planetBySys.get(e);
        if (i) {
            i.position.set(...n);
            for (const s of this.extras.get(e) || []){
                s.position.set(...n);
            }
            this.sysGlow.get(e)?.position.set(...n);
            this.over.set(e, n);
            this.updateBodies();
            this.dirty = true;
        }
    }
    updateBodies() {
        const data = this.data;
        if (!(!data || !this.bodies)) {
            for(let n = 0; n < data.bodies.length; n++){
                const body = data.bodies[n];
                const r = data.systems[this.bodySys[n]];
                if (!r) {
                    continue;
                }
                const s = this.over.get(r.id);
                const o = s ? {
                    x: s[0],
                    y: s[1],
                    z: s[2]
                } : r;
                const a = this.frozen.get(body.id) ?? (this.dragSys === body.systemId ? this.t : undefined);
                const l = this.bodyOver.get(body.id);
                const c = l ?? bodyPosition(o, body.orbit, a ?? this.t, this.speed);
                this.pos[n * 3] = c[0];
                this.pos[n * 3 + 1] = c[1];
                this.pos[n * 3 + 2] = c[2];
                this.dummy.position.set(c[0], c[1], c[2]);
                this.dummy.scale.setScalar(body.size);
                this.dummy.updateMatrix();
                this.bodies.setMatrixAt(n, this.dummy.matrix);
                this.icons.setMatrixAt(n, this.dummy.matrix);
            }
            this.bodies.instanceMatrix.needsUpdate = true;
            this.icons.instanceMatrix.needsUpdate = true;
            if (this.halo) {
                this.glowIdx.forEach((n, i)=>{
                    const r = data.bodies[n];
                    this.dummy.position.set(this.pos[n * 3], this.pos[n * 3 + 1], this.pos[n * 3 + 2]);
                    this.dummy.scale.setScalar(r.size * (2.2 + 4.5 * (r.glow?.intensity || 0)));
                    this.dummy.updateMatrix();
                    this.halo.setMatrixAt(i, this.dummy.matrix);
                });
                this.halo.instanceMatrix.needsUpdate = true;
            }
        }
    }
    syncSelection() {
        const data = this.data;
        const sel = this.sel;
        this.selMesh.visible = false;
        this.tc.getHelper().visible = false;
        this.tc.enabled = false;
        if (!(!data || !sel)) {
            if (sel.kind === "system") {
                const i = data.systems.find((r)=>r.id === sel.id);
                if (!i) {
                    return;
                }
                this.proxy.position.set(i.x, i.y, i.z);
                if (this.mode === "move") {
                    this.tc.getHelper().visible = true;
                    this.tc.enabled = true;
                }
            }
            this.dirty = true;
        }
    }
    applyBackground({ background }) {
        if (this.bg) {
            this.bgGroup.remove(this.bg.group);
            this.bg.dispose();
        }
        if (!this.bgImg) {
            this.sc.background = toColor(background.color);
        }
        this.bg = buildBackground(this.bgImg && background.preset === "nebula" ? "stars" : background.preset, {
            starDensity: background.starDensity,
            effects: background.effects,
            coarse: COARSE
        });
        this.bgGroup.add(this.bg.group);
        this.alignBackground();
    }
    /** Turns the sky so its main objects (galaxy, black hole, sun...) sit in front of the current view direction instead of somewhere out of frame. */
    alignBackground() {
        const f = this.cam.getWorldDirection(new THREE.Vector3());
        this.bgGroup.rotation.set(Math.asin(THREE.MathUtils.clamp(f.y, -1, 1)) * 0.6, Math.atan2(-f.x, -f.z), 0, "YXZ");
        this.dirty = true;
    }
    projRadius(e) {
        const n = new THREE.Vector3(this.pos[e * 3], this.pos[e * 3 + 1], this.pos[e * 3 + 2]).distanceTo(this.cam.position);
        return this.data.bodies[e].size * (this.canvas.getBoundingClientRect().height / 2 / Math.tan(this.cam.fov * Math.PI / 360)) / n;
    }
    nearBody(e, n, i) {
        const r = this.canvas.getBoundingClientRect();
        const s = new THREE.Vector3(this.pos[e * 3], this.pos[e * 3 + 1], this.pos[e * 3 + 2]);
        const o = s.distanceTo(this.cam.position);
        this.cam.updateMatrixWorld();
        s.project(this.cam);
        if (s.z > 1 || s.z < -1) {
            return false;
        }
        const a = r.height / 2 / Math.tan(this.cam.fov * Math.PI / 360);
        const l = Math.max(COARSE ? 18 : 9, this.data.bodies[e].size * a / o + (COARSE ? 8 : 4));
        return Math.hypot((s.x + 1) / 2 * r.width - (n - r.left), (1 - s.y) / 2 * r.height - (i - r.top)) <= l;
    }
    pick(e, n) {
        const i = this.canvas.getBoundingClientRect();
        const r = e - i.left;
        const s = n - i.top;
        const { width, height } = i;
        const l = new THREE.Vector3();
        let c = null;
        const u = height / 2 / Math.tan(this.cam.fov * Math.PI / 360);
        this.cam.updateMatrixWorld();
        for(let h = 0; h < this.bodyIds.length; h++){
            l.set(this.pos[h * 3], this.pos[h * 3 + 1], this.pos[h * 3 + 2]);
            const z = l.distanceTo(this.cam.position);
            l.project(this.cam);
            if (l.z > 1 || l.z < -1) {
                continue;
            }
            const m = (l.x + 1) / 2 * width;
            const y = (1 - l.y) / 2 * height;
            const g = Math.max(COARSE ? 18 : 9, this.data.bodies[h].size * u / z + (COARSE ? 8 : 4));
            if (Math.hypot(m - r, y - s) <= g && (!c || z < c.z)) {
                c = {
                    id: this.bodyIds[h],
                    kind: "body",
                    z
                };
            }
        }
        this.ray.setFromCamera(new THREE.Vector2(r / width * 2 - 1, -(s / height) * 2 + 1), this.cam);
        const f = this.ray.intersectObjects(this.planets, false)[0];
        if (f && (!c || f.distance < c.z)) {
            c = {
                id: f.object.userData.sysId,
                kind: "system",
                z: f.distance
            };
        }
        if (c) {
            return {
                kind: c.kind,
                id: c.id
            };
        }
        return null;
    }
    adapt() {
        const e = Math.min(devicePixelRatio || 1, 2);
        if (this.fps < 24 && (this.motion || this.tween)) {
            this.highN = 0;
            if (++this.lowN >= 2 && this.pr > 0.5) {
                this.pr = Math.max(0.5, this.pr * 0.8);
                this.r.setPixelRatio(this.pr);
                this.resize();
                this.lowN = 0;
            }
        } else if (this.fps > 56 && this.pr < e) {
            this.lowN = 0;
            if (++this.highN >= 5) {
                this.pr = Math.min(e, this.pr * 1.15);
                this.r.setPixelRatio(this.pr);
                this.resize();
                this.highN = 0;
            }
        } else {
            this.lowN = 0;
            this.highN = 0;
        }
    }
    updateLabels() {
        const data = this.data;
        if (!data) {
            return;
        }
        const clientWidth = this.el.clientWidth;
        const clientHeight = this.el.clientHeight;
        const r = new THREE.Vector3();
        const s = (m, y, g, d, v, _)=>{
            r.set(y, g, d).project(this.cam);
            if (r.z > 1 || r.z < -1) {
                m.style.display = "none";
                return;
            }
            m.style.display = "";
            m.style.transform = `translate(-50%,${_ ? "4px" : "-110%"}) translate(${(r.x + 1) / 2 * clientWidth}px,${(1 - r.y) / 2 * clientHeight}px)`;
            if (m.dataset.t !== v) {
                m.dataset.t = v;
                m.textContent = v;
            }
        };
        data.systems.forEach((m)=>{
            const y = this.over.get(m.id);
            const g = y ? {
                ...m,
                x: y[0],
                y: y[1],
                z: y[2]
            } : m;
            const d = this.sysLabels.get(g.id);
            if (d) {
                s(d, g.x, g.y + g.radius + 0.4, g.z, g.inbox ? this.inboxName : g.name, false);
                d.classList.toggle("on", this.sel?.id === g.id || this.hover?.id === g.id);
            }
        });
        const position = this.cam.position;
        const a = new Set();
        const l = (m)=>{
            if (m) {
                return this.bodyIds.indexOf(m);
            }
            return -1;
        };
        [
            l(this.sel?.kind === "body" ? this.sel.id : undefined),
            l(this.hover?.kind === "body" ? this.hover.id : undefined)
        ].forEach((m)=>m >= 0 && a.add(m));
        if (this.labelMode !== "off") {
            const m = this.labelMode === "all" ? t0 : LABELS;
            const y = this.labelMode === "all" ? 140 : 40;
            const g = this.bodyIds.map((d, i)=>({
                    i,
                    d: (this.pos[i * 3] - position.x) ** 2 + (this.pos[i * 3 + 1] - position.y) ** 2 + (this.pos[i * 3 + 2] - position.z) ** 2
                })).filter((d)=>d.d < y * y).sort((d, v)=>d.d - v.d);
            for (const d of g){
                if (a.size >= m) {
                    break;
                }
                a.add(d.i);
            }
        }
        const c = [
            ...a
        ];
        this.labels.forEach((m, y)=>{
            const g: any = (c as any)[y];
            if (g === undefined) {
                m.style.display = "none";
                return;
            }
            const d = data.bodies[g];
            s(m, this.pos[g * 3], this.pos[g * 3 + 1] - d.size * 1.02, this.pos[g * 3 + 2], d.title, true);
            m.classList.toggle("on", this.sel?.id === d.id || this.hover?.id === d.id);
        });
        if (this.sel?.kind === "body") {
            const m = l(this.sel.id);
            if (m >= 0) {
                this.selMesh.visible = true;
                this.selMesh.position.set(this.pos[m * 3], this.pos[m * 3 + 1], this.pos[m * 3 + 2]);
                this.selMesh.scale.setScalar(data.bodies[m].size * 1.15);
            }
        } else if (this.sel?.kind === "system") {
            const m = data.systems.find((d)=>d.id === this.sel.id);
            const y = m && this.over.get(m.id);
            const g = m && (y ? {
                ...m,
                x: y[0],
                y: y[1],
                z: y[2]
            } : m);
            if (g) {
                this.selMesh.visible = true;
                this.selMesh.position.set(g.x, g.y, g.z);
                this.selMesh.scale.setScalar(g.radius * 1.18);
            }
        }
    }
}
