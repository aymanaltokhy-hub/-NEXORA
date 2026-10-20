import { useState } from 'react'
import type { Body, Scene, System } from '../model/types'
import { t, type Lang } from '../i18n'
import { hostOf } from '../model/url'

export const openUrl = (u: string) => { if (!/^https?:\/\//i.test(u)) return; const a = (window as any).api; a?.open ? a.open(u) : window.open(u, '_blank', 'noopener,noreferrer') }
type Commit = (fn: (s: Scene) => Scene, key?: string) => void
const num = (v: string, d: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d }

export function PropsPanel({ lang, scene, body, system, commit, ops, onDeleted, onClose, onVault }: { lang: Lang; scene: Scene; body?: Body; system?: System; commit: Commit; ops: any; onDeleted(): void; onClose(): void; onVault(b: Body): void }) {
  const X = <button className="m-x" onClick={onClose} aria-label={t(lang, 'close')}>✕</button>
  if (!body && !system) return <aside className="m-props empty" aria-live="polite"><p className="m-muted">{t(lang, 'pick')}</p></aside>
  if (body) {
    const set = (p: Partial<Body>, key?: string) => commit((s) => ops.updateBody(s, body.id, p), key)
    return (
      <aside className="m-props" aria-label={body.title}>
        {X}
        <label>{t(lang, 'title')}<input dir="auto" key={body.id + body.title} defaultValue={body.title} onBlur={(e) => set({ title: e.target.value.slice(0, 120) })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} /></label>
        <label>{t(lang, 'url')}<input dir="ltr" key={body.id + body.url} defaultValue={body.url} onBlur={(e) => /^https?:\/\//i.test(e.target.value) && set({ url: e.target.value })} /></label>
        <div className="m-row"><button className="primary" onClick={() => openUrl(body.url)} disabled={!body.url}>{t(lang, 'open')} ↗</button><button onClick={() => set({ fav: !body.fav })} aria-pressed={body.fav}>{body.fav ? '★' : '☆'} {t(lang, 'fav')}</button></div>
        <label>{t(lang, 'color')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#6c8cff'} onChange={(e) => set({ color: e.target.value }, 'color')} /></label>
        <label>{t(lang, 'size')}<input type="range" min={0.3} max={0.65} step={0.05} value={body.size} onChange={(e) => set({ size: +e.target.value }, 'size')} /></label>
        <label>{t(lang, 'system')}<select value={body.systemId} onChange={(e) => commit((s) => ops.moveBody(s, body.id, e.target.value))}>{scene.systems.map((s) => <option key={s.id} value={s.id}>{s.inbox ? t(lang, 'inbox') : s.name}</option>)}</select></label>
        <label>{t(lang, 'tags')}<input dir="auto" key={body.id + body.tags.join()} defaultValue={body.tags.join(', ')} onBlur={(e) => set({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30) })} /></label>
        <label>{t(lang, 'notes')}<textarea dir="auto" key={body.id} defaultValue={body.notes} onBlur={(e) => set({ notes: e.target.value.slice(0, 20000) })} /></label>
        <button onClick={() => onVault(body)}>🔐 {t(lang, 'loginInfo')}{body.vaultIds?.length ? ` (${body.vaultIds.length})` : ''}</button>
        <p className="m-muted" dir="ltr">{hostOf(body.url)}</p>
        <div className="m-row"><button onClick={() => commit((s) => ops.duplicateBody(s, body.id)?.scene ?? s)}>{t(lang, 'dup')}</button><button className="danger" onClick={() => { commit((s) => ops.deleteBody(s, body.id)); onDeleted() }}>{t(lang, 'del')}</button></div>
      </aside>)
  }
  const s = system!, n = scene.bodies.filter((b) => b.systemId === s.id).length, set = (p: Partial<System>, key?: string) => commit((x) => ops.updateSystem(x, s.id, p), key)
  const pos = (k: 'x' | 'y' | 'z') => <input type="number" step="1" aria-label={k.toUpperCase()} key={s.id + k + s[k].toFixed(2)} defaultValue={+s[k].toFixed(2)} onBlur={(e) => set({ [k]: num(e.target.value, s[k]) } as any, 'pos')} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} />
  return (
    <aside className="m-props" aria-label={s.name}>
      {X}
      <label>{t(lang, 'sysName')}<input dir="auto" key={s.id + s.name} defaultValue={s.inbox ? t(lang, 'inbox') : s.name} disabled={!!s.inbox} onBlur={(e) => set({ name: e.target.value.slice(0, 80) || s.name })} /></label>
      <p className="m-muted">{n} {t(lang, 'links')}</p>
      <label>{t(lang, 'color')}<input type="color" value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#6c8cff'} onChange={(e) => set({ color: e.target.value }, 'color')} /></label>
      <label>{t(lang, 'position')}<div className="m-row m-xyz" dir="ltr">{pos('x')}{pos('y')}{pos('z')}</div></label>
      <div className="m-row"><button onClick={() => window.dispatchEvent(new CustomEvent('madar:addlink'))}>+ {t(lang, 'addLink')}</button><button className="danger" onClick={() => { if (!n || confirm(t(lang, 'confirmDelSys'))) { commit((x) => ops.deleteSystem(x, s.id)); onDeleted() } }}>{t(lang, 'del')}</button></div>
    </aside>)
}

export function BgPanel({ lang, scene, setBg, onImage, onClose }: { lang: Lang; scene: Scene; setBg(p: any): void; onImage(f: File | null): void; onClose(): void }) {
  const bg = scene.settings.background
  return (
    <div className="m-pop" role="dialog" aria-label={t(lang, 'background')}>
      <div className="m-row">{(['black', 'stars', 'nebula'] as const).map((p) => <button key={p} className={bg.preset === p ? 'on' : ''} onClick={() => setBg({ preset: p })} aria-pressed={bg.preset === p}>{t(lang, p)}</button>)}</div>
      <label>{t(lang, 'bgColor')}<input type="color" value={bg.color} onChange={(e) => setBg({ color: e.target.value })} /></label>
      <label>{t(lang, 'density')}<input type="range" min={0} max={1} step={0.05} value={bg.starDensity} onChange={(e) => setBg({ starDensity: +e.target.value })} /></label>
      <label>{t(lang, 'effects')}<input type="range" min={0} max={1} step={0.05} value={bg.effects} onChange={(e) => setBg({ effects: +e.target.value })} /></label>
      <div className="m-row"><label className="m-btn">{t(lang, 'uploadImg')}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onImage(e.target.files?.[0] || null); e.target.value = '' }} /></label>
        {bg.imageId && <button onClick={() => onImage(null)}>{t(lang, 'removeImg')}</button>}<button onClick={onClose}>✕</button></div>
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
