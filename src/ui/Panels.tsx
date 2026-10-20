import { useState } from 'react'
import { PRESETS, type Body, type Scene, type System } from '../model/types'
import { t, type Lang } from '../i18n'
import { hostOf } from '../model/url'
import { baseSpeed } from '../model/orbit'
import ColorField, { toHex } from './ColorField'

export const openUrl = (u: string) => { if (!/^https?:\/\//i.test(u)) return; const a = (window as any).api; a?.open ? a.open(u) : window.open(u, '_blank', 'noopener,noreferrer') }
type Commit = (fn: (s: Scene) => Scene, key?: string) => void
const num = (v: string, d: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d }

const Slider = ({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange(v: number): void }) => (
  <label>{label}<span className="m-val">{fmt ? fmt(value) : value}</span><input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(+e.target.value)} /></label>)

export function PropsPanel({ lang, scene, body, system, commit, ops, onDeleted, onClose, onVault }: { lang: Lang; scene: Scene; body?: Body; system?: System; commit: Commit; ops: any; onDeleted(): void; onClose(): void; onVault(b: Body): void }) {
  const T = (k: string) => t(lang, k), X = <button className="m-x" onClick={onClose} aria-label={T('close')}>✕</button>
  if (!body && !system) return <aside className="m-props empty" aria-live="polite"><p className="m-muted">{T('pick')}</p></aside>
  const cf = (label: string, value: string, onChange: (c: string) => void) => <ColorField label={label} value={value} onChange={onChange} custom={T('customColor')} palette={T('palette')} />
  if (body) {
    const set = (p: Partial<Body>, key?: string) => commit((s) => ops.updateBody(s, body.id, p), key), orb = (p: any, key?: string) => commit((s) => ops.updateOrbit(s, body.id, p), key)
    const sys = scene.systems.find((x) => x.id === body.systemId), o = body.orbit, mult = o.speed ? Math.abs(o.speed) / baseSpeed(o.radius) : 1, glow = body.glow?.intensity ?? 0
    return (
      <aside className="m-props" aria-label={body.title}>
        {X}
        <label>{T('title')}<input dir="auto" key={body.id + body.title} defaultValue={body.title} onBlur={(e) => set({ title: e.target.value.slice(0, 120) })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} /></label>
        <label>{T('url')}<input dir="ltr" key={body.id + body.url} defaultValue={body.url} onBlur={(e) => /^https?:\/\//i.test(e.target.value) && set({ url: e.target.value })} /></label>
        <div className="m-row"><button className="primary" onClick={() => openUrl(body.url)} disabled={!body.url}>{T('open')} ↗</button><button onClick={() => set({ fav: !body.fav })} aria-pressed={body.fav}>{body.fav ? '★' : '☆'} {T('fav')}</button></div>
        {cf(T('color'), body.color, (c) => set({ color: c }, 'color'))}
        <Slider label={T('size')} value={body.size} min={0.2} max={2.5} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ size: v }, 'size')} />
        <Slider label={T('glow')} value={glow} min={0} max={1} step={0.05} fmt={(v) => (v ? Math.round(v * 100) + '%' : '—')} onChange={(v) => set({ glow: v > 0 ? { color: body.glow?.color || body.color, intensity: v } : undefined }, 'glow')} />
        {glow > 0 && cf(T('glowColor'), body.glow?.color || body.color, (c) => set({ glow: { color: c, intensity: glow } }, 'glowc'))}
        <details className="m-sec" open><summary>{T('orbit')}{o.custom ? ' •' : ''}</summary>
          <Slider label={T('distance')} value={o.radius} min={Math.min(80, (sys?.radius ?? 2) + body.size + 0.4)} max={80} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => orb({ radius: v }, 'rad')} />
          <div className="m-row" role="group" aria-label={T('direction')}><button className={o.speed >= 0 ? 'on' : ''} aria-pressed={o.speed >= 0} onClick={() => orb({ dir: 1 })}>{T('cw')}</button><button className={o.speed < 0 ? 'on' : ''} aria-pressed={o.speed < 0} onClick={() => orb({ dir: -1 })}>{T('ccw')}</button></div>
          <Slider label={T('orbitSpeed')} value={mult} min={0.05} max={4} step={0.05} fmt={(v) => v.toFixed(2) + '×'} onChange={(v) => orb({ speedMult: v }, 'spd')} />
          <Slider label={T('tilt')} value={Math.round((o.incl * 180) / Math.PI)} min={-90} max={90} step={1} fmt={(v) => v + '°'} onChange={(v) => orb({ incl: (v * Math.PI) / 180 }, 'tilt')} />
          <Slider label={T('ecc')} value={o.ecc || 0} min={0} max={0.85} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => orb({ ecc: v }, 'ecc')} />
          {o.custom && <button onClick={() => commit((s) => ops.resetOrbit(s, body.id))}>{T('autoOrbit')}</button>}</details>
        <label>{T('system')}<select value={body.systemId} onChange={(e) => commit((s) => ops.moveBody(s, body.id, e.target.value))}>{scene.systems.map((s) => <option key={s.id} value={s.id}>{s.inbox ? T('inbox') : s.name}</option>)}</select></label>
        <label>{T('tags')}<input dir="auto" key={body.id + body.tags.join()} defaultValue={body.tags.join(', ')} onBlur={(e) => set({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30) })} /></label>
        <label>{T('notes')}<textarea dir="auto" key={body.id} defaultValue={body.notes} onBlur={(e) => set({ notes: e.target.value.slice(0, 20000) })} /></label>
        <button onClick={() => onVault(body)}>🔐 {T('loginInfo')}{body.vaultIds?.length ? ` (${body.vaultIds.length})` : ''}</button>
        <p className="m-muted" dir="ltr">{hostOf(body.url)}</p>
        <div className="m-row"><button onClick={() => commit((s) => ops.duplicateBody(s, body.id)?.scene ?? s)}>{T('dup')}</button><button className="danger" onClick={() => { commit((s) => ops.deleteBody(s, body.id)); onDeleted() }}>{T('del')}</button></div>
      </aside>)
  }
  const s = system!, n = scene.bodies.filter((b) => b.systemId === s.id).length, set = (p: Partial<System>, key?: string) => commit((x) => ops.updateSystem(x, s.id, p), key), glow = s.glow?.intensity ?? 0
  const pos = (k: 'x' | 'y' | 'z') => <input type="number" step="1" aria-label={k.toUpperCase()} key={s.id + k + s[k].toFixed(2)} defaultValue={+s[k].toFixed(2)} onBlur={(e) => set({ [k]: num(e.target.value, s[k]) } as any, 'pos')} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} />
  return (
    <aside className="m-props" aria-label={s.name}>
      {X}
      <label>{T('sysName')}<input dir="auto" key={s.id + s.name} defaultValue={s.inbox ? T('inbox') : s.name} disabled={!!s.inbox} onBlur={(e) => set({ name: e.target.value.slice(0, 80) || s.name })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} /></label>
      <p className="m-muted">{n} {T('links')}</p>
      {cf(T('color'), s.color, (c) => set({ color: c }, 'color'))}
      <Slider label={T('planetSize')} value={s.radius} min={0.8} max={14} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => set({ radius: v }, 'size')} />
      <Slider label={T('glow')} value={glow} min={0} max={1} step={0.05} fmt={(v) => (v ? Math.round(v * 100) + '%' : '—')} onChange={(v) => set({ glow: v > 0 ? { color: s.glow?.color || s.color, intensity: v } : undefined }, 'glow')} />
      {glow > 0 && cf(T('glowColor'), s.glow?.color || s.color, (c) => set({ glow: { color: c, intensity: glow } }, 'glowc'))}
      <label>{T('position')}<div className="m-row m-xyz" dir="ltr">{pos('x')}{pos('y')}{pos('z')}</div></label>
      <div className="m-row"><button onClick={() => window.dispatchEvent(new CustomEvent('madar:addlink'))}>+ {T('addLink')}</button><button className="danger" onClick={() => { if (!n || confirm(T('confirmDelSys'))) { commit((x) => ops.deleteSystem(x, s.id)); onDeleted() } }}>{T('del')}</button></div>
    </aside>)
}

export function BgPanel({ lang, scene, setBg, setView, onImage, onClose }: { lang: Lang; scene: Scene; setBg(p: any): void; setView(p: any): void; onImage(f: File | null): void; onClose(): void }) {
  const bg = scene.settings.background, view = scene.settings.view || { labels: 'near', icons: true }, T = (k: string) => t(lang, k)
  return (
    <div className="m-pop m-bgpop" role="dialog" aria-label={T('background')}>
      <b>{T('background3')}</b>
      <div className="m-presets">{PRESETS.map((p) => <button key={p} className={bg.preset === p ? 'on' : ''} onClick={() => setBg({ preset: p })} aria-pressed={bg.preset === p}>{T(p)}</button>)}</div>
      <label>{T('bgColor')}<input type="color" value={toHex(bg.color)} onChange={(e) => setBg({ color: e.target.value })} /></label>
      <Slider label={T('density')} value={bg.starDensity} min={0} max={1} step={0.05} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => setBg({ starDensity: v })} />
      <Slider label={T('effects')} value={bg.effects} min={0} max={1} step={0.05} fmt={(v) => Math.round(v * 100) + '%'} onChange={(v) => setBg({ effects: v })} />
      <div className="m-row"><label className="m-btn">{T('uploadImg')}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onImage(e.target.files?.[0] || null); e.target.value = '' }} /></label>{bg.imageId && <button onClick={() => onImage(null)}>{T('removeImg')}</button>}</div>
      <b>{T('display')}</b>
      <label className="chk"><input type="checkbox" checked={view.icons} onChange={(e) => setView({ icons: e.target.checked })} />{T('viewIcons')}</label>
      <label>{T('labelsMode')}<select value={view.labels} onChange={(e) => setView({ labels: e.target.value })}><option value="near">{T('near')}</option><option value="all">{T('all')}</option><option value="off">{T('off')}</option></select></label>
      <button onClick={onClose}>✕ {T('close')}</button>
    </div>)
}

export function TextDialog({ lang, title, initial = '', placeholder = '', ltr = false, onSubmit, onClose }: { lang: Lang; title: string; initial?: string; placeholder?: string; ltr?: boolean; onSubmit(v: string): boolean; onClose(): void }) {
  const [v, setV] = useState(initial), [err, setErr] = useState(false)
  const go = () => (onSubmit(v) ? onClose() : setErr(true))
  return (
    <div className="m-modal" onClick={onClose}><div className="m-card small" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
      <h3>{title}</h3>
      <input autoFocus dir={ltr ? 'ltr' : 'auto'} placeholder={placeholder} value={v} onChange={(e) => { setV(e.target.value); setErr(false) }} onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') onClose() }} />
      {err && <p className="warn">{t(lang, 'invalidUrl')}</p>}
      <div className="m-row end"><button onClick={onClose}>{t(lang, 'cancel')}</button><button className="primary" onClick={go}>{t(lang, 'add')}</button></div>
    </div></div>)
}
