import { useEffect, useMemo, useState } from 'react'
import './madar.css'
import Diagnostics from './Diagnostics'
import { createStorage, openWorkspace, isDesktop, type Storage } from '../storage'
import { makeLegacyDemo } from '../model/demo'
import { migrateLegacy } from '../model/migrate'
import type { Body, Report, Scene } from '../model/types'
import { dirOf, t, type Lang } from '../i18n'

const Logo = () => (<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="5" fill="#6C8CFF" /><ellipse cx="16" cy="16" rx="13" ry="6" fill="none" stroke="#45D6B5" strokeWidth="1.6" transform="rotate(-25 16 16)" /><circle cx="27" cy="11" r="2" fill="#F4F6FA" /></svg>)
const openUrl = (u: string) => { if (!/^https?:\/\//i.test(u)) return; const a = (window as any).api; a?.open ? a.open(u) : window.open(u, '_blank', 'noopener,noreferrer') }

export default function Shell() {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'ar')
  const [st, setSt] = useState<Storage | null>(null), [ws, setWs] = useState<{ id: string; name: string }[]>([]), [wsId, setWsId] = useState('')
  const [scene, setScene] = useState<Scene | null>(null), [report, setReport] = useState<Report | null>(null), [err, setErr] = useState(''), [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null), [diag, setDiag] = useState(false)
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = dirOf(lang); localStorage.setItem('lang', lang) }, [lang])
  const load = async (s: Storage, id: string) => { const r = await openWorkspace(s, id); setWsId(id); setScene(r.scene); setReport(r.migrated || null); setSel(null); await s.setLast(id) }
  useEffect(() => { (async () => {
    try { const s = createStorage(); setSt(s); const l = await s.listWorkspaces(); setWs(l.workspaces); await load(s, l.last || l.workspaces[0].id) } catch (e: any) { setErr(String(e.message || e)) }
  })() }, [])
  const refreshWs = async (s: Storage) => setWs((await s.listWorkspaces()).workspaces)
  const demo = async () => {
    if (!st) return
    const id = await st.createWorkspace(lang === 'ar' ? 'تجريبي' : 'Demo'), { scene: sc } = migrateLegacy(makeLegacyDemo(300, 6))
    await st.saveScene(id, sc); await refreshWs(st); await load(st, id)
  }
  const bySys = useMemo(() => { const m = new Map<string, Body[]>(); scene?.bodies.forEach((b) => { (m.get(b.systemId) || m.set(b.systemId, []).get(b.systemId)!).push(b) }); return m }, [scene])
  const needle = q.trim().toLowerCase(), match = (b: Body) => !needle || [b.title, b.url, ...b.tags].join(' ').toLowerCase().includes(needle)
  const body = scene?.bodies.find((b) => b.id === sel)
  if (err) return <div className="m-app"><p className="warn m-pad">{err}</p></div>
  return (
    <div className="m-app">
      <header className="m-top">
        <div className="m-brand"><Logo /><b>MADAR</b><span>| مدار</span></div>
        <select aria-label={t(lang, 'workspaces')} value={wsId} onChange={(e) => st && load(st, e.target.value)}>{ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <input className="m-search" dir="auto" placeholder={t(lang, 'search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t(lang, 'search')} />
        <span className="m-sp" />
        <button onClick={demo}>{t(lang, 'demo')}</button>
        {isDesktop() && <a className="m-btn" href="#classic" onClick={() => setTimeout(() => location.reload(), 0)}>{t(lang, 'classic')}</a>}
        <button onClick={() => setDiag(true)}>{t(lang, 'diag')}</button>
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{t(lang, 'lang')}</button>
      </header>
      {report && <div className="m-note">✓ {t(lang, 'migrated')}: {report.systems} {t(lang, 'systems')} · {report.bodies} {t(lang, 'bodies')} · {report.inbox} {t(lang, 'inbox')}
        {(report.legacyKept.strokes + report.legacyKept.texts) > 0 && <> · {report.legacyKept.strokes} {t(lang, 'strokes')} + {report.legacyKept.texts} {t(lang, 'texts')} {t(lang, 'kept')}</>}</div>}
      <div className="m-body">
        <main className="m-list" aria-label={t(lang, 'systems')}>
          {scene && !scene.systems.length && <p className="m-muted">{t(lang, 'none')}</p>}
          {scene?.systems.map((s) => { const items = (bySys.get(s.id) || []).filter(match); if (needle && !items.length) return null
            return (<details key={s.id} open={!!needle || scene.systems.length < 4}><summary><i style={{ background: s.color }} /><span dir="auto">{s.inbox ? t(lang, 'inbox') : s.name}</span><em>{items.length}</em></summary>
              {!items.length && <p className="m-muted">{t(lang, 'empty')}</p>}
              <ul>{items.map((b) => <li key={b.id}><button className={b.id === sel ? 'on' : ''} onClick={() => setSel(b.id)}><i style={{ background: b.color }} /><span dir="auto">{b.fav ? '★ ' : ''}{b.title}</span></button></li>)}</ul></details>) })}
        </main>
        <aside className="m-props" aria-live="polite">
          {body ? (<><h3 dir="auto">{body.title}</h3><p className="m-muted" dir="ltr">{body.url}</p>
            <button className="primary" onClick={() => openUrl(body.url)}>{t(lang, 'open')} ↗</button>
            {body.tags.length > 0 && <p>{t(lang, 'tags')}: {body.tags.join(', ')}</p>}{body.notes && <p dir="auto">{body.notes}</p>}</>) : <p className="m-muted">{t(lang, 'pick')}</p>}
        </aside>
      </div>
      {diag && <Diagnostics onClose={() => setDiag(false)} />}
    </div>)
}
