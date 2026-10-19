import { create } from 'zustand'
import type { Obj, VP } from './types'
import { inside, norm, textH } from './geom'
export type { Obj, VP }
export type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'poly' | 'free'
type Changes = Record<string, Obj | null>
type Patch = { before: Changes; after: Changes; key?: string; t: number }
const uid = () => crypto.randomUUID()
let timer: any, vpTimer: any
const applyCh = (o: Record<string, Obj>, c: Changes) => { const n = { ...o }; for (const id in c) c[id] ? (n[id] = c[id]!) : delete n[id]; return n }
export function flush() {
  clearTimeout(timer)
  const { wsId, objects, ready } = useStore.getState()
  if (ready && wsId) window.api.saveObjects(wsId, Object.values(objects))
}
const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 400) }
const nextZ = (objs: Record<string, Obj>, zone: boolean) => Object.values(objs).filter((o) => (o.type === 'zone') === zone).reduce((m, o) => Math.max(m, o.z), 0) + 1
const host = (u?: string) => { try { return new URL(u || '').hostname.replace(/^www\./, '') } catch { return '' } }
function normUrl(raw: string) {
  let url = raw.trim(); if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try { const u = new URL(url); return u.hostname.includes('.') || u.hostname === 'localhost' ? u.href : null } catch { return null }
}
async function enrich(ids: string[]) {
  let i = 0
  const run = async () => {
    while (i < ids.length) {
      const id = ids[i++], o = useStore.getState().objects[id]; if (!o?.url) continue
      try {
        const m = await window.api.meta(o.url); const cur = useStore.getState().objects[id]; if (!cur) continue
        const t = cur.title === host(cur.url) && m.title ? m.title.slice(0, 60) : cur.title
        useStore.setState({ objects: { ...useStore.getState().objects, [id]: { ...cur, title: t, favicon: m.favicon ?? cur.favicon } } }); schedule()
      } catch {}
    }
  }
  await Promise.all([run(), run(), run()])
}

interface S {
  workspaces: { id: string; name: string }[]; wsId: string; objects: Record<string, Obj>; selected: string[]
  past: Patch[]; future: Patch[]; vp: VP; size: { w: number; h: number }; clip: Obj[]
  theme: 'dark' | 'light'; grid: boolean; ready: boolean; tool: Tool; penColor: string; penWidth: number
  vault: { open: boolean; filter: string }
  init: (id?: string) => Promise<void>; commit: (c: Changes, key?: string) => void
  undo: () => void; redo: () => void; select: (ids: string[]) => void; setVp: (v: VP) => void
  setTool: (t: Tool) => void; setPen: (p: { penColor?: string; penWidth?: number }) => void; setVault: (open: boolean, filter?: string) => void
  addLink: (url: string) => boolean; importLinks: (items: { url: string; title?: string }[]) => number
  addZone: (s: 'rect' | 'round' | 'ellipse') => void; addPolyZone: (abs: number[]) => void
  addStroke: (abs: number[], hl: boolean) => void; addText: (x: number, y: number) => string
  remove: () => void; duplicate: () => void; copy: () => void; paste: () => void; layer: (d: number) => void
  group: () => void; ungroup: () => void
  fit: () => void; go: (id: string) => void; newWs: () => Promise<void>
  renameWs: (id: string, n: string) => Promise<void>; delWs: (id: string) => Promise<void>
  toggleTheme: () => void; toggleGrid: () => void
}
export const useStore = create<S>((set, get) => ({
  workspaces: [], wsId: '', objects: {}, selected: [], past: [], future: [], vp: { x: 0, y: 0, scale: 1 },
  size: { w: 800, h: 600 }, clip: [], theme: 'dark', grid: true, ready: false, tool: 'select', penColor: '#6C8CFF', penWidth: 3,
  vault: { open: false, filter: '' },
  async init(id) {
    flush()
    const d = await window.api.load(id)
    set({ workspaces: d.workspaces, wsId: d.wsId, objects: Object.fromEntries(d.objects.map((o: Obj) => [o.id, o])),
      vp: d.viewport || { x: 0, y: 0, scale: 1 }, selected: [], past: [], future: [], ready: true })
  },
  commit(changes, key) {
    const { objects, past } = get(); const before: Changes = {}
    for (const id in changes) before[id] = objects[id] ?? null
    const last = past[past.length - 1], now = Date.now()
    const p = key && last && last.key === key && now - last.t < 800
      ? [...past.slice(0, -1), { ...last, before: { ...before, ...last.before }, after: { ...last.after, ...changes }, t: now }]
      : [...past, { before, after: changes, key, t: now }].slice(-200)
    set({ objects: applyCh(objects, changes), past: p, future: [] }); schedule()
  },
  undo() { const { past, future, objects } = get(); const p = past[past.length - 1]; if (!p) return
    set({ objects: applyCh(objects, p.before), past: past.slice(0, -1), future: [...future, p], selected: [] }); schedule() },
  redo() { const { past, future, objects } = get(); const p = future[future.length - 1]; if (!p) return
    set({ objects: applyCh(objects, p.after), future: future.slice(0, -1), past: [...past, p], selected: [] }); schedule() },
  select: (selected) => set({ selected }),
  setTool: (tool) => set({ tool, selected: tool === 'select' ? get().selected : [] }),
  setPen: (p) => set(p as any),
  setVault: (open, filter = '') => set({ vault: { open, filter } }),
  setVp(vp) { set({ vp }); clearTimeout(vpTimer); vpTimer = setTimeout(() => window.api.saveViewport(get().wsId, get().vp), 400) },
  addLink(raw) {
    const url = normUrl(raw); if (!url) return false
    const { vp, size, objects, commit } = get(); const n = Object.values(objects).filter((o) => o.type === 'link').length % 5
    const o: Obj = { id: uid(), type: 'link', url, title: host(url), favicon: null, w: 190, h: 56, rotation: 0, z: nextZ(objects, false),
      x: (size.w / 2 - vp.x) / vp.scale - 95 + n * 12, y: (size.h / 2 - vp.y) / vp.scale - 28 + n * 12 }
    commit({ [o.id]: o }); set({ selected: [o.id] }); enrich([o.id]); return true
  },
  importLinks(items) {
    const { vp, objects, commit } = get(); const ch: Changes = {}; let z = nextZ(objects, false), i = 0
    const seen = new Set(Object.values(objects).map((o) => o.url))
    for (const it of items) {
      const url = normUrl(it.url); if (!url || seen.has(url)) continue; seen.add(url)
      const o: Obj = { id: uid(), type: 'link', url, title: (it.title || host(url)).slice(0, 60), favicon: null, w: 190, h: 56, rotation: 0, z: z++,
        x: -vp.x / vp.scale + 40 + (i % 6) * 210, y: -vp.y / vp.scale + 40 + Math.floor(i / 6) * 76 }
      ch[o.id] = o; i++
    }
    if (i) { commit(ch); set({ selected: Object.keys(ch) }); enrich(Object.keys(ch)) }
    return i
  },
  addZone(shape) {
    const { vp, size, objects, commit } = get()
    const o: Obj = { id: uid(), type: 'zone', shape, title: 'Zone', w: 380, h: 260, rotation: 0, z: nextZ(objects, true),
      x: (size.w / 2 - vp.x) / vp.scale - 190, y: (size.h / 2 - vp.y) / vp.scale - 130, color: '#6C8CFF', opacity: 0.18, stroke: '#6C8CFF', strokeWidth: 2, mode: 'visual' }
    commit({ [o.id]: o }); set({ selected: [o.id] })
  },
  addPolyZone(abs) {
    const { objects, commit } = get(); const n = norm(abs)
    const o: Obj = { id: uid(), type: 'zone', shape: 'poly', title: 'Zone', ...n, rotation: 0, z: nextZ(objects, true),
      color: '#45D6B5', opacity: 0.18, stroke: '#45D6B5', strokeWidth: 2, mode: 'visual' }
    commit({ [o.id]: o }); set({ selected: [o.id], tool: 'select' })
  },
  addStroke(abs, hl) {
    const { objects, commit, penColor, penWidth } = get(); const n = norm(abs)
    const o: Obj = { id: uid(), type: 'stroke', ...n, rotation: 0, z: nextZ(objects, false), stroke: penColor, strokeWidth: hl ? penWidth * 4 : penWidth, opacity: hl ? 0.35 : 1 }
    commit({ [o.id]: o })
  },
  addText(x, y) {
    const { objects, commit } = get()
    const o: Obj = { id: uid(), type: 'text', x, y, w: 220, h: 0, rotation: 0, z: nextZ(objects, false), text: 'Text', fontSize: 20, align: 'left' }
    o.h = textH(o); commit({ [o.id]: o }); set({ selected: [o.id], tool: 'select' }); return o.id
  },
  remove() { const { selected, commit } = get(); if (!selected.length) return; commit(Object.fromEntries(selected.map((id) => [id, null]))); set({ selected: [] }) },
  copy() { const { selected, objects } = get(); set({ clip: selected.map((id) => objects[id]).filter(Boolean) }) },
  paste() {
    const { clip, commit, objects } = get(); if (!clip.length) return
    const ch: Changes = {}; let z = nextZ(objects, false)
    clip.forEach((o) => { const n = { ...o, id: uid(), x: o.x + 30, y: o.y + 30, z: o.type === 'zone' ? nextZ(objects, true) : z++ }; ch[n.id] = n })
    commit(ch); set({ selected: Object.keys(ch), clip: clip.map((o) => ({ ...o, x: o.x + 30, y: o.y + 30 })) })
  },
  duplicate() { get().copy(); get().paste() },
  layer(d) { const { selected, objects, commit } = get(); const ch: Changes = {}; selected.forEach((id) => { const o = objects[id]; if (o) ch[id] = { ...o, z: o.z + d } }); commit(ch) },
  group() {
    const { selected, objects, commit } = get(); const gid = uid(); const ch: Changes = {}
    selected.forEach((id) => { const o = objects[id]; if (o && o.type !== 'zone') ch[id] = { ...o, group: gid } as any })
    if (Object.keys(ch).length > 1) commit(ch)
  },
  ungroup() { const { selected, objects, commit } = get(); const ch: Changes = {}; selected.forEach((id) => { const o: any = objects[id]; if (o?.group) { const { group, ...r } = o; ch[id] = r } }); commit(ch) },
  fit() {
    const { objects, size } = get(); const a = Object.values(objects); if (!a.length) return get().setVp({ x: 0, y: 0, scale: 1 })
    const x0 = Math.min(...a.map((o) => o.x)), y0 = Math.min(...a.map((o) => o.y)), x1 = Math.max(...a.map((o) => o.x + o.w)), y1 = Math.max(...a.map((o) => o.y + o.h))
    const s = Math.min(2, Math.max(0.1, Math.min(size.w / (x1 - x0 + 120), size.h / (y1 - y0 + 120))))
    get().setVp({ scale: s, x: size.w / 2 - ((x0 + x1) / 2) * s, y: size.h / 2 - ((y0 + y1) / 2) * s })
  },
  go(id) {
    const o = get().objects[id]; if (!o) return; const { size, vp } = get(); const sc = Math.max(vp.scale, 0.6)
    get().setVp({ scale: sc, x: size.w / 2 - (o.x + o.w / 2) * sc, y: size.h / 2 - (o.y + o.h / 2) * sc }); set({ selected: [id], tool: 'select' })
  },
  async newWs() { const id = await window.api.createWs(`Workspace ${get().workspaces.length + 1}`); await get().init(id) },
  async renameWs(id, n) { if (n.trim()) { await window.api.renameWs(id, n.trim()); await get().init(get().wsId) } },
  async delWs(id) { if (await window.api.deleteWs(id)) await get().init(id === get().wsId ? undefined : get().wsId) },
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  toggleGrid: () => set((s) => ({ grid: !s.grid }))
}))
window.addEventListener('beforeunload', flush)
export { inside }
