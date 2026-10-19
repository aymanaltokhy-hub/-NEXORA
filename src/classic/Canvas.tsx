import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Group, Rect, Ellipse, Line, Text, Circle, Image as KImage, Transformer } from 'react-konva'
import { useStore, inside } from './store'
import { rgba, textH } from './geom'
import type { Obj } from './types'

function useImg(src?: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => { if (!src) return setImg(null); const i = new Image(); i.onload = () => setImg(i); i.onerror = () => setImg(null); i.src = src }, [src])
  return img
}
function LinkBody({ o, dark }: { o: Obj; dark: boolean }) {
  const img = useImg(o.favicon); const t = o.title || o.url || '?'
  return (<>
    <Rect width={o.w} height={o.h} cornerRadius={12} fill={o.color || (dark ? '#202633' : '#FFFFFF')} stroke={o.fav ? '#F5B83D' : dark ? '#303850' : '#D5DAE6'} strokeWidth={o.fav ? 2 : 1} shadowBlur={8} shadowOpacity={0.15} />
    {img ? <KImage image={img} x={14} y={o.h / 2 - 12} width={24} height={24} />
      : <><Circle x={26} y={o.h / 2} radius={12} fill="#6C8CFF" /><Text x={14} y={o.h / 2 - 7} width={24} align="center" text={t[0].toUpperCase()} fontSize={14} fill="#fff" /></>}
    <Text x={48} y={0} width={o.w - 58} height={o.h} verticalAlign="middle" wrap="none" ellipsis text={t} fontSize={14} fill={dark ? '#F4F6FA' : '#1A2230'} />
  </>)
}
function ZoneBody({ o }: { o: Obj }) {
  const p = { fill: rgba(o.color, o.opacity ?? 0.2), stroke: o.stroke, strokeWidth: o.strokeWidth }
  return (<>
    {o.shape === 'ellipse' ? <Ellipse x={o.w / 2} y={o.h / 2} radiusX={o.w / 2} radiusY={o.h / 2} {...p} />
      : o.shape === 'poly' ? <Line points={o.points} closed lineJoin="round" {...p} />
      : <Rect width={o.w} height={o.h} cornerRadius={o.shape === 'round' ? 28 : 0} {...p} />}
    <Text x={12} y={8} text={o.title || ''} fontSize={16} fontStyle="bold" fill={o.stroke} listening={false} />
  </>)
}
const StrokeBody = ({ o }: { o: Obj }) => <Line points={o.points} stroke={o.stroke} strokeWidth={o.strokeWidth} opacity={o.opacity} lineCap="round" lineJoin="round" tension={0.4} hitStrokeWidth={Math.max(12, o.strokeWidth || 0)} />
const TextBody = ({ o, dark }: { o: Obj; dark: boolean }) => (<>
  {o.bg && <Rect width={o.w} height={o.h} fill={rgba(o.bg, 0.9)} cornerRadius={6} />}
  <Text text={o.text} width={o.w} padding={6} fontSize={o.fontSize} align={o.align} fill={o.textColor || (dark ? '#F4F6FA' : '#1A2230')}
    fontStyle={[o.italic && 'italic', o.bold && 'bold'].filter(Boolean).join(' ') || 'normal'} />
</>)

export default function Canvas() {
  const s = useStore(); const dark = s.theme === 'dark'
  const stage = useRef<any>(null), tr = useRef<any>(null), wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<any>(null), mq = useRef<any>(null), drawing = useRef(false)
  const [space, setSpace] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const [marq, setMarq] = useState<any>(null)
  const [erased, setErased] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const byId = (id: string) => stage.current?.findOne((n: any) => n.id() === id)
  const pan = space || s.tool === 'hand', sel = s.tool === 'select'

  useEffect(() => {
    const ro = new ResizeObserver(() => { const r = wrap.current!.getBoundingClientRect(); useStore.setState({ size: { w: r.width, h: r.height } }) })
    ro.observe(wrap.current!); (window as any).nexoraStage = stage.current; return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const k = (v: boolean) => (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName; if (t === 'INPUT' || t === 'TEXTAREA') return
      if (e.code === 'Space') { setSpace(v); if (v) e.preventDefault() }
      if (v && e.key === 'Escape') setDraft([])
    }
    const d = k(true), u = k(false); window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])
  useEffect(() => { setDraft([]) }, [s.tool])
  useEffect(() => {
    const ids = sel ? expand(s.selected) : []
    tr.current.nodes(ids.map(byId).filter(Boolean)); tr.current.getLayer()?.batchDraw()
  }, [s.selected, s.objects, s.tool])

  const groupOf = (id: string) => (s.objects[id] as any)?.group as string | undefined
  const expand = (ids: string[]) => { const gs = new Set(ids.map(groupOf).filter(Boolean)); return gs.size ? Object.keys(s.objects).filter((i) => ids.includes(i) || gs.has(groupOf(i))) : ids }
  const world = () => stage.current.getRelativePointerPosition()
  const onWheel = (e: any) => {
    e.evt.preventDefault(); const old = s.vp.scale, p = stage.current.getPointerPosition()
    const ns = Math.min(5, Math.max(0.1, old * (e.evt.deltaY > 0 ? 1 / 1.1 : 1.1))); const m = { x: (p.x - s.vp.x) / old, y: (p.y - s.vp.y) / old }
    s.setVp({ scale: ns, x: p.x - m.x * ns, y: p.y - m.y * ns })
  }
  const lastE = useRef<any>(null)
  const segD = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }
  const eraseAt = (p: any) => {
    const last = lastE.current || p; lastE.current = p; const r = 8 / s.vp.scale
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / (r / 2))), pts: any[] = []
    for (let i = 0; i <= steps; i++) pts.push({ x: last.x + ((p.x - last.x) * i) / steps, y: last.y + ((p.y - last.y) * i) / steps })
    const hit = Object.values(s.objects).filter((o) => o.type === 'stroke' && !erased.includes(o.id) && pts.some((q) => {
      const a = o.points!, rad = r + (o.strokeWidth || 1) / 2
      if (a.length < 4) return Math.hypot(o.x + a[0] - q.x, o.y + a[1] - q.y) < rad
      for (let i = 0; i < a.length - 2; i += 2) if (segD(q.x, q.y, o.x + a[i], o.y + a[i + 1], o.x + a[i + 2], o.y + a[i + 3]) < rad) return true
      return false
    })).map((o) => o.id)
    if (hit.length) setErased((e) => [...new Set([...e, ...hit])])
  }
  const onDown = (e: any) => {
    if (pan) return
    const p = world(), t = s.tool
    if (t === 'select') { if (e.target === stage.current) { if (!e.evt.shiftKey) s.select([]); mq.current = { x: p.x, y: p.y, shift: e.evt.shiftKey }; setMarq({ x: p.x, y: p.y, w: 0, h: 0 }) } return }
    if (t === 'pen' || t === 'highlighter' || t === 'free') { drawing.current = true; setDraft([p.x, p.y]) }
    else if (t === 'eraser') { drawing.current = true; lastE.current = null; setErased([]); eraseAt(p) }
    else if (t === 'poly') setDraft((d) => [...d, p.x, p.y])
    else if (t === 'text') setEditing(s.addText(p.x, p.y))
  }
  const onMove = () => {
    const p = world()
    if (mq.current) { const m = mq.current; setMarq({ x: Math.min(m.x, p.x), y: Math.min(m.y, p.y), w: Math.abs(p.x - m.x), h: Math.abs(p.y - m.y) }) }
    else if (drawing.current) {
      if (s.tool === 'eraser') eraseAt(p)
      else setDraft((d) => (Math.hypot(p.x - d[d.length - 2], p.y - d[d.length - 1]) * s.vp.scale > 2 ? [...d, p.x, p.y] : d))
    }
  }
  const onUp = () => {
    if (mq.current) {
      const r = marq, shift = mq.current.shift; mq.current = null; setMarq(null)
      if (r && (r.w > 3 || r.h > 3)) {
        const ids = Object.values(s.objects).filter((o) => o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y).map((o) => o.id)
        s.select(shift ? [...new Set([...s.selected, ...ids])] : ids)
      }
      return
    }
    if (!drawing.current) return; drawing.current = false
    if (s.tool === 'eraser') { lastE.current = null; if (erased.length) s.commit(Object.fromEntries(erased.map((id) => [id, null]))); setErased([]); return }
    let d = draft; setDraft([])
    if (s.tool === 'free') { if (d.length >= 6) s.addPolyZone(d) }
    else if (d.length >= 2) { if (d.length < 4) d = [d[0], d[1], d[0] + 0.1, d[1]]; s.addStroke(d, s.tool === 'highlighter') }
  }
  const pick = (e: any, o: Obj) => {
    e.cancelBubble = true; const ids = groupOf(o.id) ? expand([o.id]) : [o.id]
    s.select(e.evt.shiftKey || e.evt.ctrlKey ? (s.selected.includes(o.id) ? s.selected.filter((i) => !ids.includes(i)) : [...s.selected, ...ids]) : ids)
  }
  const dStart = (o: Obj) => {
    let ids = new Set(expand(s.selected.includes(o.id) ? s.selected : groupOf(o.id) ? expand([o.id]) : [o.id]))
    if (!s.selected.includes(o.id)) s.select([...ids])
    ;[...ids].forEach((id) => { const z = s.objects[id]; if (z?.type === 'zone' && z.mode === 'container') Object.values(s.objects).filter((l) => l.type !== 'zone' && inside(z, l)).forEach((l) => ids.add(l.id)) })
    const start: any = {}; ids.forEach((id) => { const n = byId(id); if (n) start[id] = { x: n.x(), y: n.y() } }); drag.current = { id: o.id, start }
  }
  const dMove = () => {
    const d = drag.current; if (!d) return; const me = byId(d.id), dx = me.x() - d.start[d.id].x, dy = me.y() - d.start[d.id].y
    for (const id in d.start) if (id !== d.id) byId(id)?.position({ x: d.start[id].x + dx, y: d.start[id].y + dy })
  }
  const dEnd = () => {
    const d = drag.current; if (!d) return; const ch: any = {}
    for (const id in d.start) { const n = byId(id); if (n && s.objects[id]) ch[id] = { ...s.objects[id], x: n.x(), y: n.y() } }
    drag.current = null; s.commit(ch)
  }
  const tEnd = () => {
    const ch: any = {}
    tr.current.nodes().forEach((n: any) => {
      const o = s.objects[n.id()]; if (!o) return; const sx = n.scaleX(), sy = n.scaleY(); const u: any = { ...o, x: n.x(), y: n.y(), rotation: n.rotation() }
      if (o.points) { u.points = o.points.map((v, i) => v * (i % 2 ? sy : sx)); u.w = o.w * sx; u.h = o.h * sy }
      else if (o.type === 'text') { u.w = Math.max(40, o.w * sx); u.fontSize = Math.max(8, Math.round((o.fontSize || 20) * sy)); u.h = textH(u) }
      else { u.w = Math.max(24, o.w * sx); u.h = Math.max(24, o.h * sy) }
      ch[o.id] = u; n.scale({ x: 1, y: 1 })
    })
    s.commit(ch)
  }
  const vx0 = -s.vp.x / s.vp.scale - 300, vy0 = -s.vp.y / s.vp.scale - 300, vx1 = vx0 + s.size.w / s.vp.scale + 600, vy1 = vy0 + s.size.h / s.vp.scale + 600
  const vis = (o: Obj) => s.selected.includes(o.id) || (o.x + o.w > vx0 && o.x < vx1 && o.y + o.h > vy0 && o.y < vy1)
  const list = (zone: boolean) => Object.values(s.objects).filter((o) => (o.type === 'zone') === zone && !erased.includes(o.id) && vis(o)).sort((a, b) => a.z - b.z)
  const node = (o: Obj) => (
    <Group key={o.id} id={o.id} x={o.x} y={o.y} rotation={o.rotation} listening={sel} draggable={sel && !o.locked && !space}
      onClick={(e) => pick(e, o)} onTap={(e) => pick(e, o)} onDragStart={() => dStart(o)} onDragMove={dMove} onDragEnd={dEnd}
      onDblClick={() => (o.type === 'link' && o.url ? window.api.open(o.url) : o.type === 'text' && setEditing(o.id))}>
      {o.type === 'link' ? <LinkBody o={o} dark={dark} /> : o.type === 'zone' ? <ZoneBody o={o} /> : o.type === 'stroke' ? <StrokeBody o={o} /> : <TextBody o={o} dark={dark} />}
    </Group>)
  const g = 24 * s.vp.scale, eo = editing ? s.objects[editing] : null
  const endEdit = (v: string) => { if (eo) { const u = { ...eo, text: v }; u.h = textH(u); s.commit({ [eo.id]: u }) } setEditing(null) }
  return (
    <div ref={wrap} className="canvas" style={{ cursor: pan ? 'grab' : sel ? 'default' : 'crosshair', ...(s.grid ? { backgroundSize: `${g}px ${g}px`, backgroundPosition: `${s.vp.x}px ${s.vp.y}px` } : { backgroundImage: 'none' }) }}>
      <Stage ref={stage} width={s.size.w} height={s.size.h} draggable={pan} x={s.vp.x} y={s.vp.y} scaleX={s.vp.scale} scaleY={s.vp.scale}
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onDblClick={() => { if (s.tool === 'poly' && draft.length >= 8) { s.addPolyZone(draft.slice(0, -2)); setDraft([]) } }}
        onDragEnd={(e) => e.target === stage.current && s.setVp({ ...s.vp, x: e.target.x(), y: e.target.y() })}>
        <Layer>{list(true).map(node)}</Layer>
        <Layer>
          {list(false).map(node)}
          {draft.length >= 2 && <Line points={draft} listening={false} stroke={s.tool === 'free' || s.tool === 'poly' ? '#45D6B5' : s.penColor} dash={s.tool === 'free' || s.tool === 'poly' ? [6, 4] : undefined}
            strokeWidth={s.tool === 'highlighter' ? s.penWidth * 4 : s.tool === 'pen' ? s.penWidth : 2} opacity={s.tool === 'highlighter' ? 0.35 : 1} lineCap="round" lineJoin="round" tension={s.tool === 'pen' || s.tool === 'highlighter' ? 0.4 : 0} />}
          {s.tool === 'poly' && Array.from({ length: draft.length / 2 }, (_, i) => <Circle key={i} x={draft[i * 2]} y={draft[i * 2 + 1]} radius={4 / s.vp.scale} fill="#45D6B5" listening={false} />)}
          {marq && <Rect {...marq} stroke="#6C8CFF" strokeWidth={1 / s.vp.scale} fill="rgba(108,140,255,.12)" listening={false} />}
          <Transformer ref={tr} rotateEnabled keepRatio={false} anchorSize={8} borderStroke="#6C8CFF" anchorStroke="#6C8CFF" onTransformEnd={tEnd} />
        </Layer>
      </Stage>
      {eo && <textarea ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = '1'; setTimeout(() => { el.focus(); el.select() }, 60) } }} className="texted" defaultValue={eo.text} onBlur={(e) => endEdit(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && (e.target as HTMLElement).blur()}
        style={{ left: s.vp.x + eo.x * s.vp.scale, top: s.vp.y + eo.y * s.vp.scale, width: eo.w * s.vp.scale, minHeight: eo.h * s.vp.scale, fontSize: (eo.fontSize || 20) * s.vp.scale, fontWeight: eo.bold ? 700 : 400, fontStyle: eo.italic ? 'italic' : 'normal', textAlign: eo.align as any }} />}
    </div>)
}
