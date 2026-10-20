import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './madar.css'
import Diagnostics from './Diagnostics'
import Space from './Space'
import ListView from './ListView'
import { PropsPanel, BgPanel, TextDialog } from './Panels'
import VaultPanel from './VaultPanel'
import { VaultService } from '../vault/service'
import { createStorage, openWorkspace, isDesktop, type Storage } from '../storage'
import { putBlob, getBlob, delBlob, validateImage } from '../storage/blobs'
import { makeLegacyDemo } from '../model/demo'
import { migrateLegacy } from '../model/migrate'
import * as ops from '../model/ops'
import { validateScene } from '../model/validate'
import { normUrl, hostOf } from '../model/url'
import { webIcon } from './iconFetch'
import { openUrl } from './Panels'
import type { Report, Scene, Vec3 } from '../model/types'
import type { Engine, Sel } from '../engine/Engine'
import { dirOf, t, type Lang } from '../i18n'

const Logo = () => (<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="5" fill="#6C8CFF" /><ellipse cx="16" cy="16" rx="13" ry="6" fill="none" stroke="#45D6B5" strokeWidth="1.6" transform="rotate(-25 16 16)" /><circle cx="27" cy="11" r="2" fill="#F4F6FA" /></svg>)
type H = { scene: Scene | null; past: Scene[]; future: Scene[]; key?: string; t: number }

export default function Shell() {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'ar')
  const [st, setSt] = useState<Storage | null>(null), [ws, setWs] = useState<{ id: string; name: string }[]>([]), [wsId, setWsId] = useState('')
  const [h, setH] = useState<H>({ scene: null, past: [], future: [], t: 0 }), [report, setReport] = useState<Report | null>(null), [err, setErr] = useState(''), [saveErr, setSaveErr] = useState('')
  const [q, setQ] = useState(''), [sel, setSel] = useState<Sel>(null), [diag, setDiag] = useState(false), [view, setView] = useState<'3d' | 'list'>((localStorage.getItem('view') as any) || '3d')
  const [gl, setGl] = useState<'ok' | 'fail' | 'lost'>('ok'), [mode, setMode] = useState<'navigate' | 'move'>('navigate'), [bgOpen, setBgOpen] = useState(false), [addOpen, setAddOpen] = useState(false), [sysDlg, setSysDlg] = useState(false), [vault, setVault] = useState<{ open: boolean; filter: string; bodyId?: string }>({ open: false, filter: '' }), [more, setMore] = useState(false), [installEv, setInstallEv] = useState<any>(null), [bgUrl, setBgUrl] = useState<string | null>(null), [toast, setToast] = useState('')
  const engine = useRef<Engine | null>(null), saved = useRef<Scene | null>(null), wsRef = useRef(''), scene = h.scene
  const svc = useMemo(() => (st ? new VaultService(st.vault) : null), [st])
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 900px)').matches)
  useEffect(() => { const m = matchMedia('(max-width: 900px)'), f = () => setNarrow(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  const coarse = useMemo(() => matchMedia('(pointer: coarse)').matches, [])
  useEffect(() => { const f = (e: any) => { e.preventDefault(); setInstallEv(e) }; window.addEventListener('beforeinstallprompt', f); return () => window.removeEventListener('beforeinstallprompt', f) }, [])
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const T = (k: string) => t(lang, k)
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = dirOf(lang); localStorage.setItem('lang', lang) }, [lang])
  useEffect(() => { localStorage.setItem('view', view) }, [view])
  useEffect(() => { if (toast) { const x = setTimeout(() => setToast(''), 3500); return () => clearTimeout(x) } }, [toast])

  // ----- scene state with undo/redo (structural sharing keeps snapshots cheap) -----
  const commit = useCallback((fn: (s: Scene) => Scene, key?: string) => setH((c) => {
    if (!c.scene) return c; const n = fn(c.scene); if (n === c.scene) return c; const now = Date.now()
    return key && key === c.key && now - c.t < 800 ? { ...c, scene: n, t: now } : { scene: n, past: [...c.past.slice(-99), c.scene], future: [], key, t: now }
  }), [])
  const silent = useCallback((fn: (s: Scene) => Scene) => setH((c) => (c.scene ? { ...c, scene: fn(c.scene) } : c)), [])
  const undo = () => setH((c) => (c.past.length ? { scene: c.past[c.past.length - 1], past: c.past.slice(0, -1), future: [c.scene!, ...c.future], t: 0 } : c))
  const redo = () => setH((c) => (c.future.length ? { scene: c.future[0], past: [...c.past, c.scene!], future: c.future.slice(1), t: 0 } : c))
  const setSettings = (p: Partial<Scene['settings']>) => silent((s) => ({ ...s, settings: { ...s.settings, ...p } }))
  const setBg = (p: any) => setSettings({ background: { ...scene!.settings.background, ...p } })
  const setViewCfg = (p: any) => setSettings({ view: { labels: 'near', icons: true, ...scene!.settings.view, ...p } as any })

  // ----- persistence: debounced autosave with visible failure + retry -----
  const doSave = useCallback(async () => {
    const s = h.scene; if (!st || !s || !wsRef.current || s === saved.current) return
    try { await st.saveScene(wsRef.current, s); saved.current = s; setSaveErr('') } catch (e: any) { setSaveErr(String(e?.message || e)) }
  }, [st, h.scene])
  useEffect(() => { if (!h.scene || h.scene === saved.current) return; const x = setTimeout(doSave, 500); return () => clearTimeout(x) }, [h.scene, doSave])
  const load = async (s: Storage, id: string) => {
    if (saved.current !== h.scene) await doSave()
    const r = await openWorkspace(s, id); wsRef.current = id; saved.current = r.scene; setWsId(id); setH({ scene: r.scene, past: [], future: [], t: 0 }); setReport(r.migrated || null); setSel(null); await s.setLast(id)
  }
  useEffect(() => { (async () => {
    try { const s = createStorage(); setSt(s); const l = await s.listWorkspaces(); setWs(l.workspaces); await load(s, l.last || l.workspaces[0].id) } catch (e: any) { setErr(String(e.message || e)) }
  })() }, [])
  const refreshWs = async (s: Storage) => setWs((await s.listWorkspaces()).workspaces)
  const newWs = async () => { if (!st) return; const id = await st.createWorkspace(`${T('newWs')} ${ws.length + 1}`); await refreshWs(st); await load(st, id) }
  const demo = async () => { if (!st) return; const id = await st.createWorkspace(lang === 'ar' ? 'تجريبي' : 'Demo'); await st.saveScene(id, migrateLegacy(makeLegacyDemo(300, 6)).scene); await refreshWs(st); await load(st, id) }

  // ----- custom background image (local only) -----
  const imgId = scene?.settings.background.imageId || null
  useEffect(() => { let url: string | null = null, live = true; if (!imgId) { setBgUrl(null); return } getBlob(imgId).then((b) => { if (b && live) { url = URL.createObjectURL(b); setBgUrl(url) } }).catch(() => setBgUrl(null)); return () => { live = false; if (url) URL.revokeObjectURL(url) } }, [imgId])
  const onImage = async (f: File | null) => {
    if (!f) { await delBlob('bg').catch(() => {}); return setBg({ imageId: null }) }
    if (!(await validateImage(f))) return setToast(T('imgBad')); await putBlob('bg', f); setBg({ imageId: 'bg' }); setBgUrl(URL.createObjectURL(f))
  }

  // ----- derived selection -----
  const body = sel?.kind === 'body' ? scene?.bodies.find((b) => b.id === sel.id) : undefined, system = sel?.kind === 'system' ? scene?.systems.find((s) => s.id === sel.id) : undefined
  useEffect(() => { if (sel && scene && !body && !system) setSel(null) }, [scene])
  const select = (s: Sel, fly = false) => { setSel(s); if (fly && s && view === '3d') setTimeout(() => engine.current?.focus(s), 0) }

  // ----- actions -----
  const addLink = (raw: string) => {
    const url = normUrl(raw); if (!url || !scene) return false
    const target = body?.systemId ?? system?.id ?? null; let id = ''
    commit((s) => { const r = ops.addBody(s, target, { url }); id = r.id; return r.scene })
    setTimeout(() => { setSel({ kind: 'body', id }); (window as any).api?.meta?.(url).then((m: any) => silent((s) => ops.updateBody(s, id, { title: m?.title ? String(m.title).slice(0, 120) : s.bodies.find((b) => b.id === id)?.title || '', favicon: m?.favicon ?? null }))).catch(() => {}) }, 0)
    return true
  }
  const addSystem = (name: string) => { let id = ''; commit((s) => { const r = ops.addSystem(s, name.trim() || T('newSystem'), ['#6C8CFF', '#45D6B5', '#F5B83D', '#E4608A', '#9B7BFF', '#4CC9F0'][s.systems.length % 6]); id = r.id; return r.scene }); setTimeout(() => select({ kind: 'system', id }, true), 0); return true }
  /** Fetch site icons for links that have none. Desktop asks the main process; the web build asks an icon service only after explicit consent. */
  const fetchIcons = async () => {
    if (!scene) return; const todo = scene.bodies.filter((b) => !b.favicon && b.url); if (!todo.length) return setToast(T('iconsNone'))
    const desktop = isDesktop(); if (!desktop && !confirm(T('iconsWebConfirm'))) return
    setToast(T('iconsStart')); let i = 0, got = 0
    const worker = async () => { while (i < todo.length) { const b = todo[i++]; let ic: string | null = null
      try { ic = desktop ? ((await (window as any).api.meta(b.url))?.favicon ?? null) : await webIcon(hostOf(b.url)) } catch {}
      if (ic) { got++; silent((x) => ops.updateBody(x, b.id, { favicon: ic })) } } }
    await Promise.all([worker(), worker(), worker()]); setToast(`${T('iconsDone')}: ${got}/${todo.length}`)
  }
  const exportJson = () => { if (!scene) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ format: 'madar-scene-v1', exported: new Date().toISOString(), scene }, null, 1)], { type: 'application/json' })); a.download = `madar-${ws.find((w) => w.id === wsId)?.name || 'workspace'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }
  const importJson = async (f?: File) => {
    if (!f) return; try { const v = validateScene(JSON.parse(await f.text())); if (!confirm(T('confirmImport'))) return; commit(() => ({ ...v, settings: { ...v.settings, background: { ...v.settings.background, imageId: scene?.settings.background.imageId ?? null } } })); setToast(T('importOk')) } catch { setToast(T('importBad')) }
  }
  useEffect(() => { const f = () => setAddOpen(true); window.addEventListener('madar:addlink', f); return () => window.removeEventListener('madar:addlink', f) }, [])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName), c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase()
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') svcRef.current?.lock()
      if (e.key === 'Escape') { setAddOpen(false); setMore(false); setSysDlg(false); setBgOpen(false); setSel(null); return }
      if (typing) return
      if (c && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() } else if (c && k === 'y') { e.preventDefault(); redo() }
      else if (c && k === 'n') { e.preventDefault(); setAddOpen(true) }
      else if (!c && k === 'f') engine.current?.focus(selRef.current, false)
      else if (e.key === 'Home') engine.current?.viewAll()
      else if (e.key === 'Delete' && selRef.current?.kind === 'body') { const id = selRef.current.id; commit((s) => ops.deleteBody(s, id)); setSel(null) }
    }
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd)
  }, [])
  const selRef = useRef<Sel>(null); selRef.current = sel; const svcRef = useRef<VaultService | null>(null); svcRef.current = svc

  // ----- search -----
  const needle = q.trim().toLowerCase()
  const results = useMemo(() => !scene || !needle ? [] : [
    ...scene.systems.filter((s) => (s.inbox ? t(lang, 'inbox') : s.name).toLowerCase().includes(needle)).map((s) => ({ sel: { kind: 'system', id: s.id } as Sel, label: s.inbox ? t(lang, 'inbox') : s.name, sub: t(lang, 'system'), color: s.color })),
    ...scene.bodies.filter((b) => [b.title, b.url, ...b.tags].join(' ').toLowerCase().includes(needle)).map((b) => ({ sel: { kind: 'body', id: b.id } as Sel, label: b.title, sub: b.url, color: b.color }))].slice(0, 8), [scene, needle, lang])

  useEffect(() => { if (localStorage.getItem('madarDebug')) (window as any).__madar = { engine: () => engine.current, scene: () => h.scene, sel: () => sel } })
  if (err) return <div className="m-app"><p className="warn m-pad">{err}</p></div>
  const is3d = view === '3d' && gl !== 'fail', canUndo = h.past.length > 0, canRedo = h.future.length > 0, motionOn = !!scene?.settings.motion.enabled
  return (
    <div className="m-app">
      <header className="m-top">
        <div className="m-brand"><Logo /><b>MADAR</b><span>| مدار</span></div>
        <select aria-label={T('workspaces')} value={wsId} onChange={(e) => st && load(st, e.target.value)}>{ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <button className="m-hide-sm" onClick={newWs} aria-label={T('newWs')} title={T('newWs')}>＋</button>
        <div className="m-searchwrap"><input className="m-search" dir="auto" placeholder={T('search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={T('search')}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { select(results[0].sel, true); setQ('') } if (e.key === 'Escape') setQ('') }} />
          {is3d && needle && <ul className="m-results" role="listbox">{results.length ? results.map((r, i) => <li key={i}><button role="option" onClick={() => { select(r.sel, true); setQ('') }}><i style={{ background: r.color }} /><span dir="auto">{r.label}</span><small dir="ltr">{r.sub}</small></button></li>) : <li className="m-muted m-pad">{T('noResults')}</li>}</ul>}</div>
        <span className="m-sp" />
        <div className="m-seg" role="group"><button className={is3d ? 'on' : ''} onClick={() => setView('3d')} disabled={gl === 'fail'} aria-pressed={is3d}>{T('view3d')}</button><button className={!is3d ? 'on' : ''} onClick={() => setView('list')} aria-pressed={!is3d}>{T('viewList')}</button></div>
        <button onClick={() => setVault({ open: true, filter: '' })} aria-label={T('vault')} title={T('vault')}>🔐<span className="m-lbl-d"> {T('vault')}</span></button>
        <div className="m-rel"><button onClick={() => setMore(!more)} aria-expanded={more} aria-label={T('more')}>⋯</button>
          {more && <div className="m-pop m-menu" role="menu" onClick={() => setMore(false)}>
            <button role="menuitem" onClick={newWs}>{T('newWs')}</button>
            <button role="menuitem" onClick={demo}>{T('demo')}</button>
            <button role="menuitem" onClick={fetchIcons} disabled={!scene}>{T('fetchIcons')}</button>
            <button role="menuitem" onClick={exportJson} disabled={!scene}>{T('export')}</button>
            <label className="m-btn" role="menuitem">{T('import')}<input type="file" accept="application/json,.json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = '' }} /></label>
            {isDesktop() && <a className="m-btn" role="menuitem" href="#classic" onClick={() => setTimeout(() => location.reload(), 0)}>{T('classic')}</a>}
            {!isDesktop() && <button role="menuitem" onClick={() => (installEv ? (installEv.prompt(), setInstallEv(null)) : setToast(T('installHelp')))}>{T('install')}</button>}
            <button role="menuitem" onClick={() => setDiag(true)}>{T('diag')}</button><button role="menuitem" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{T('lang')}</button></div>}</div>
      </header>
      <div className="m-tools" role="toolbar" aria-label="tools">
        <button onClick={() => setAddOpen(true)}>＋ {T('addLink')}</button><button onClick={() => setSysDlg(true)}>＋ {T('addSystem')}</button>
        <button onClick={undo} disabled={!canUndo} aria-label={T('undo')} title={`${T('undo')} (Ctrl+Z)`}>↶</button><button onClick={redo} disabled={!canRedo} aria-label={T('redo')} title={`${T('redo')} (Ctrl+Y)`}>↷</button>
        {is3d && <>
          <span className="m-sep" />
          <div className="m-seg" role="group"><button className={mode === 'navigate' ? 'on' : ''} onClick={() => setMode('navigate')} aria-pressed={mode === 'navigate'}>{T('navigate')}</button>
            <button className={mode === 'move' ? 'on' : ''} onClick={() => { setMode('move'); if (!system) setToast(T('selectSys')) }} aria-pressed={mode === 'move'} title={T('moveMode')}>{T('move')}</button></div>
          <button onClick={() => engine.current?.viewAll()}>{T('viewAll')}</button><button onClick={() => engine.current?.focus(sel)} disabled={!sel}>{T('focus')}</button><button onClick={() => engine.current?.viewAll()}>{T('reset')}</button>
          <span className="m-sep" />
          <button onClick={() => setSettings({ motion: { ...scene!.settings.motion, enabled: !motionOn } })} aria-pressed={motionOn} title={reduced ? T('reducedOn') : ''}>{motionOn ? '⏸ ' + T('pause') : '▶ ' + T('play')}</button>
          <label className="m-inl">{T('speed')}<input type="range" min={0.2} max={4} step={0.1} value={scene?.settings.motion.speed ?? 1} onChange={(e) => setSettings({ motion: { ...scene!.settings.motion, speed: +e.target.value } })} /></label>
          <div className="m-rel"><button onClick={() => setBgOpen(!bgOpen)} aria-expanded={bgOpen}>{T('background')}</button>{bgOpen && scene && <BgPanel lang={lang} scene={scene} setBg={setBg} setView={setViewCfg} onImage={onImage} onClose={() => setBgOpen(false)} />}</div></>}
      </div>
      {report && <div className="m-note">✓ {T('migrated')}: {report.systems} {T('systems')} · {report.bodies} {T('bodies')} · {report.inbox} {T('inbox')}{(report.legacyKept.strokes + report.legacyKept.texts) > 0 && <> · {report.legacyKept.strokes} {T('strokes')} + {report.legacyKept.texts} {T('texts')} {T('kept')}</>}</div>}
      {gl === 'fail' && <div className="m-note warnbar">{T('webglFail')}</div>}{gl === 'lost' && <div className="m-note warnbar">{T('ctxLost')}</div>}
      {saveErr && <div className="m-note warnbar">{T('saveFailed')}: {saveErr} <button onClick={doSave}>{T('retry')}</button></div>}
      <div className="m-body">
        {scene && (is3d
          ? <div className="m-stagewrap"><Space scene={scene} selection={sel} mode={mode} bottomInset={narrow && sel ? Math.round(innerHeight * 0.4) : 0} bgUrl={bgUrl} inboxName={T('inbox')} engineRef={engine} onStatus={setGl} onPick={(s) => select(s)}
              onDouble={(s) => { select(s); if (s.kind === 'body') { const b = scene.bodies.find((x) => x.id === s.id); if (b) openUrl(b.url) } else engine.current?.focus(s) }}
              onBodyDrop={(id, sysId) => { if (!sysId) return setToast(T('dropNone')); commit((x) => ops.moveBody(x, id, sysId)); const n = scene.systems.find((x) => x.id === sysId); setToast(`${T('moved')}: ${n?.inbox ? T('inbox') : n?.name}`) }}
              onSystemMoved={(id, p: Vec3, final) => final && commit((s) => ops.updateSystem(s, id, { x: p[0], y: p[1], z: p[2] }))}
              onCamera={(c) => silent((s) => ({ ...s, settings: { ...s.settings, camera: { ...c, moved: true } } }))} />
              {!scene.systems.length && <p className="m-empty">{T('none')}</p>}<div className="m-hint" aria-hidden="true">{T(coarse ? 'hintTouch' : 'hint')}</div></div>
          : <ListView scene={scene} q={q} sel={sel} onSelect={(s) => select(s)} lang={lang} />)}
        {scene && <PropsPanel lang={lang} scene={scene} body={body} system={system} commit={commit} ops={ops} onDeleted={() => setSel(null)} onClose={() => setSel(null)} onVault={(b) => setVault({ open: true, filter: hostOf(b.url), bodyId: b.id })} />}
      </div>
      {addOpen && <TextDialog lang={lang} title={T('addLinkTitle')} placeholder="https://example.com" ltr onSubmit={addLink} onClose={() => setAddOpen(false)} />}
      {sysDlg && <TextDialog lang={lang} title={T('sysName')} initial={T('newSystem')} onSubmit={addSystem} onClose={() => setSysDlg(false)} />}
      {vault.open && st && svc && <VaultPanel st={st} lang={lang} svc={svc} filter={vault.filter} linkBodyId={vault.bodyId} linkedIds={scene?.bodies.find((b) => b.id === vault.bodyId)?.vaultIds || []}
        onLink={(eid, on) => vault.bodyId && commit((x) => ops.updateBody(x, vault.bodyId!, { vaultIds: on ? [...(x.bodies.find((b) => b.id === vault.bodyId)?.vaultIds || []), eid] : (x.bodies.find((b) => b.id === vault.bodyId)?.vaultIds || []).filter((i) => i !== eid) }))}
        onClose={() => setVault({ open: false, filter: '' })} onToast={setToast} />}
      {toast && <div className="m-toast" role="status">{toast}</div>}
      {diag && <Diagnostics onClose={() => setDiag(false)} stats={() => engine.current?.stats() ?? null} />}
    </div>)
}
