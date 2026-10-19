import { useEffect, useRef, useState } from 'react'
import Canvas from './Canvas'
import Vault from './Vault'
import { useStore, Tool } from './store'
import { textH } from './geom'
import type { Obj } from './types'

function Props() {
  const s = useStore(); const o: Obj | null = s.selected.length === 1 ? s.objects[s.selected[0]] : null
  if (!o) return <aside className="props"><p className="muted">{s.selected.length ? `${s.selected.length} selected` : 'Select an object'}</p>
    {s.selected.length > 1 && <div className="row"><button onClick={s.group}>Group</button><button onClick={s.ungroup}>Ungroup</button><button className="danger" onClick={s.remove}>Delete</button></div>}</aside>
  const set = (p: Partial<Obj>, key?: string) => { const m = { ...o, ...p }; if (m.type === 'text') m.h = textH(m); s.commit({ [o.id]: m }, key) }
  const hex = (k: 'color' | 'stroke' | 'textColor' | 'bg', label: string, def: string) => (
    <label>{label}<div className="row"><input type="color" value={(o as any)[k] || def} onChange={(e) => set({ [k]: e.target.value }, k)} />
      <input key={o.id + ((o as any)[k] || '')} defaultValue={(o as any)[k] || def} onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && set({ [k]: e.target.value })} /></div></label>)
  const range = (label: string, k: keyof Obj, min: number, max: number, step: number, def: number) =>
    <label>{label}<input type="range" min={min} max={max} step={step} value={(o[k] as number) ?? def} onChange={(e) => set({ [k]: +e.target.value }, String(k))} /></label>
  const host = (() => { try { return new URL(o.url || '').hostname.replace(/^www\./, '') } catch { return '' } })()
  return (
    <aside className="props">
      <h4>{o.type}</h4>
      {(o.type === 'link' || o.type === 'zone') && <label>{o.type === 'link' ? 'Title' : 'Name'}<input key={o.id + o.title} defaultValue={o.title} onBlur={(e) => set({ title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} /></label>}
      {o.type === 'link' && <>
        <label>URL<input key={o.id + o.url} defaultValue={o.url} onBlur={(e) => /^https?:\/\//i.test(e.target.value) && set({ url: e.target.value })} /></label>
        {hex('color', 'Card color', '#202633')}
        <label>Tags (comma separated)<input key={o.id + (o.tags || []).join()} defaultValue={(o.tags || []).join(', ')} onBlur={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} /></label>
        <label>Notes<textarea key={o.id} defaultValue={o.notes} onBlur={(e) => set({ notes: e.target.value })} /></label>
        <div className="row"><button onClick={() => set({ fav: !o.fav })}>{o.fav ? '★ Favorite' : '☆ Favorite'}</button><button onClick={() => navigator.clipboard.writeText(o.url || '')}>Copy URL</button></div>
        <div className="row"><button onClick={() => window.api.open(o.url)}>Open</button><button onClick={() => s.setVault(true, host)}>Login info</button></div></>}
      {o.type === 'zone' && <>
        {hex('color', 'Fill', '#6C8CFF')}{range('Fill opacity', 'opacity', 0, 1, 0.02, 0.2)}{hex('stroke', 'Border', '#6C8CFF')}{range('Border width', 'strokeWidth', 0, 12, 1, 2)}
        <label>Mode<select value={o.mode} onChange={(e) => set({ mode: e.target.value as any })}><option value="visual">Visual (background only)</option><option value="container">Container (moves contents)</option></select></label></>}
      {o.type === 'stroke' && <>{hex('stroke', 'Color', '#6C8CFF')}{range('Width', 'strokeWidth', 1, 40, 1, 3)}{range('Opacity', 'opacity', 0.1, 1, 0.05, 1)}</>}
      {o.type === 'text' && <>
        {hex('textColor', 'Text color', '#F4F6FA')}
        <label>Background<div className="row"><input type="color" value={o.bg || '#202633'} onChange={(e) => set({ bg: e.target.value }, 'bg')} /><button onClick={() => set({ bg: undefined })}>None</button></div></label>
        <label>Font size<input type="number" min={8} max={200} value={o.fontSize} onChange={(e) => set({ fontSize: +e.target.value }, 'fs')} /></label>
        <div className="row"><button onClick={() => set({ bold: !o.bold })}><b>B</b></button><button onClick={() => set({ italic: !o.italic })}><i>I</i></button>
          <select value={o.align} onChange={(e) => set({ align: e.target.value })}><option>left</option><option>center</option><option>right</option></select></div>
        <p className="muted">Double-click the text to edit.</p></>}
      <div className="row"><button onClick={() => set({ locked: !o.locked })}>{o.locked ? 'Unlock' : 'Lock'}</button><button onClick={() => s.layer(1)}>Forward</button><button onClick={() => s.layer(-1)}>Back</button></div>
      <div className="row"><button onClick={s.duplicate}>Duplicate</button><button className="danger" onClick={s.remove}>Delete</button></div>
    </aside>)
}

function Palette({ onClose }: { onClose: () => void }) {
  const s = useStore(); const [q, setQ] = useState(''), [res, setRes] = useState<any[]>([]), [vres, setV] = useState<any[]>([])
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      const r = await window.api.search(q); if (!live) return; setRes(r)
      const st = await window.api.vaultStatus()
      if (st.unlocked && q && !q.startsWith('#')) { const l = await window.api.vaultList(); setV(l.filter((e: any) => [e.name, e.username, e.email, e.url].join(' ').toLowerCase().includes(q.toLowerCase())).slice(0, 6)) } else setV([])
    }, 120)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  const go = async (r: any) => { onClose(); if (r.ws !== s.wsId) await s.init(r.ws); s.go(r.id) }
  return (
    <div className="modal top" onClick={onClose}><div className="palette" onClick={(e) => e.stopPropagation()}>
      <input autoFocus placeholder="Search links, zones, text, tags… (#tag · fav · domain)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      <div className="vlist">
        {res.map((r) => <div key={r.ws + r.id} className="hit" onClick={() => go(r)}><b>{r.fav ? '★ ' : ''}{r.label || r.type}</b><span className="muted">{r.type} · {r.wsName}</span></div>)}
        {vres.map((e) => <div key={e.id} className="hit" onClick={() => { onClose(); s.setVault(true, e.name) }}><b>🔐 {e.name}</b><span className="muted">{e.username || e.email}</span></div>)}
        {!res.length && !vres.length && <p className="muted">No results.</p>}
      </div></div></div>)
}

const TOOLS: [Tool, string, string][] = [['select', '↖', 'Select (V)'], ['hand', '✋', 'Pan (H)'], ['pen', '✎', 'Pen (P)'], ['highlighter', '▮', 'Highlighter'], ['eraser', '⌫', 'Eraser (E)'], ['text', 'T', 'Text (T)'], ['poly', '⬠', 'Polygon zone'], ['free', '〰', 'Freehand zone']]

export default function App() {
  const s = useStore(); const [modal, setModal] = useState(false), [pal, setPal] = useState(false), [url, setUrl] = useState(''), [err, setErr] = useState(false), [edit, setEdit] = useState('')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { s.init() }, [])
  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])
  useEffect(() => {
    const typing = (e: Event) => ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
    const kd = (e: KeyboardEvent) => {
      const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), st = useStore.getState()
      if (c && k === 'n') { e.preventDefault(); setModal(true) }
      if (c && k === 'k') { e.preventDefault(); setPal(true) }
      if (c && e.shiftKey && k === 'l') { window.api.vaultLock() }
      if (e.key === 'Escape') { setModal(false); setPal(false); st.setTool('select') }
      if (typing(e)) return
      if (c && k === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo() }
      else if (c && k === 'y') st.redo()
      else if (c && k === 'c') st.copy()
      else if (c && k === 'v') st.paste()
      else if (c && k === 'd') { e.preventDefault(); st.duplicate() }
      else if (c && k === 'a') { e.preventDefault(); st.select(Object.keys(st.objects)) }
      else if (c && k === 'g') { e.preventDefault(); e.shiftKey ? st.ungroup() : st.group() }
      else if (e.key === 'Delete' || e.key === 'Backspace') st.remove()
      else if (!c) { const m: any = { v: 'select', h: 'hand', p: 'pen', e: 'eraser', t: 'text' }; if (m[k]) { e.preventDefault(); st.setTool(m[k]) } }
    }
    const paste = (e: ClipboardEvent) => { if (typing(e)) return; const t = e.clipboardData?.getData('text') || ''; if (/^https?:\/\/\S+$/i.test(t.trim())) { e.preventDefault(); useStore.getState().addLink(t) } }
    const drop = (e: DragEvent) => { e.preventDefault(); const t = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text') || ''; if (/^https?:\/\//i.test(t.trim())) useStore.getState().addLink(t.split('\n')[0]) }
    window.addEventListener('keydown', kd); window.addEventListener('paste', paste); window.addEventListener('dragover', (e) => e.preventDefault()); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('paste', paste); window.removeEventListener('drop', drop) }
  }, [])
  const submit = () => { if (s.addLink(url)) { setModal(false); setUrl(''); setErr(false) } else setErr(true) }
  const importHtml = async (f?: File) => {
    if (!f) return; const doc = new DOMParser().parseFromString(await f.text(), 'text/html')
    const items = Array.from(doc.querySelectorAll('a[href]')).map((a) => ({ url: a.getAttribute('href') || '', title: a.textContent || '' }))
    alert(`Imported ${s.importLinks(items)} of ${items.length} bookmarks (duplicates and invalid URLs skipped).`)
  }
  const png = () => { const st = (window as any).nexoraStage; if (st) window.api.savePng(st.toDataURL({ pixelRatio: 2 })) }
  return (
    <div className="app">
      <nav className="side"><div className="brand">NEXORA</div>
        {s.workspaces.map((w) => (
          <div key={w.id} className={'ws' + (w.id === s.wsId ? ' on' : '')} onClick={() => w.id !== s.wsId && s.init(w.id)}>
            {edit === w.id ? <input autoFocus defaultValue={w.name} onBlur={(e) => { s.renameWs(w.id, e.target.value); setEdit('') }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} />
              : <><span onDoubleClick={() => setEdit(w.id)}>{w.name}</span>{s.workspaces.length > 1 && <b title="Delete" onClick={(e) => { e.stopPropagation(); confirm(`Delete "${w.name}" and everything in it?`) && s.delWs(w.id) }}>×</b>}</>}
          </div>))}
        <button onClick={s.newWs}>+ Workspace</button>
        <hr /><button onClick={() => setPal(true)}>🔍 Search (Ctrl+K)</button><button onClick={() => s.setVault(true)}>🔐 Vault</button>
        <button onClick={() => file.current?.click()}>Import bookmarks…</button>
        <button onClick={() => window.api.exportWs(s.wsId)}>Export workspace (JSON)</button><button onClick={png}>Export view (PNG)</button>
        <input ref={file} type="file" accept=".html,.htm" hidden onChange={(e) => { importHtml(e.target.files?.[0]); e.target.value = '' }} />
        <p className="muted">Double-click a workspace to rename. Ctrl+G groups, Ctrl+Shift+L locks the vault.</p></nav>
      <main>
        <header>
          {TOOLS.map(([t, i, tip]) => <button key={t} title={tip} className={s.tool === t ? 'on' : ''} onClick={() => s.setTool(t)}>{i}</button>)}
          {(s.tool === 'pen' || s.tool === 'highlighter') && <><input type="color" value={s.penColor} onChange={(e) => s.setPen({ penColor: e.target.value })} /><input type="range" min={1} max={20} value={s.penWidth} onChange={(e) => s.setPen({ penWidth: +e.target.value })} /></>}
          <span className="sep" /><button onClick={() => setModal(true)}>+ Link</button>
          <button onClick={() => s.addZone('rect')}>▭</button><button onClick={() => s.addZone('round')}>▢</button><button onClick={() => s.addZone('ellipse')}>◯</button>
          <span className="sp" />
          <button onClick={s.undo} disabled={!s.past.length}>↶</button><button onClick={s.redo} disabled={!s.future.length}>↷</button>
          <button onClick={s.fit}>Fit</button><button onClick={s.toggleGrid}>Grid</button><button onClick={s.toggleTheme}>{s.theme === 'dark' ? '☀' : '☾'}</button>
        </header>
        <div className="body"><Canvas /><Props /></div>
      </main>
      {modal && <div className="modal" onClick={() => setModal(false)}><div onClick={(e) => e.stopPropagation()}>
        <h3>Add link</h3><input autoFocus placeholder="https://example.com" value={url} onChange={(e) => { setUrl(e.target.value); setErr(false) }} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <p className="err">Invalid URL</p>}<div className="row"><button onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={submit}>Add</button></div></div></div>}
      {pal && <Palette onClose={() => setPal(false)} />}
      {s.vault.open && <Vault />}
    </div>)
}
