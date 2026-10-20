import { useEffect, useMemo, useRef, useState } from 'react'
import type { Storage } from '../storage'
import { VaultService, type Entry } from '../vault/service'
import { genPw, strength, copySecret, POOL_KEYS } from '../vault/util'
import { t, type Lang } from '../i18n'
import { hostOf } from '../model/url'
import { openUrl } from './Panels'

const empty = (): Entry => ({ name: '', url: '', username: '', email: '', password: '', recovery: '', notes: '', tags: '', created: Date.now() })
export default function VaultPanel({ st, lang, svc, filter, linkBodyId, linkedIds, onLink, onClose, onToast }: { st: Storage; lang: Lang; svc: VaultService; filter: string; linkBodyId?: string; linkedIds: string[]; onLink(id: string, on: boolean): void; onClose(): void; onToast(m: string): void }) {
  const T = (k: string) => t(lang, k)
  const [exists, setExists] = useState<boolean | null>(null), [open, setOpen] = useState(svc.unlocked), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const [list, setList] = useState<(Entry & { id: string })[]>([]), [q, setQ] = useState(filter), [form, setForm] = useState<Entry | null>(null), [shown, setShown] = useState<string[]>([]), [len, setLen] = useState(20), [sets, setSets] = useState(['lower', 'upper', 'digits', 'sym'])
  const [mins, setMins] = useState(+(localStorage.getItem('autolock') || 5)), [oldVault, setOldVault] = useState(false), timer = useRef<any>(0), file = useRef<HTMLInputElement>(null)
  const api = (window as any).api
  const refresh = async () => { setExists(await svc.exists()); if (svc.unlocked) { setList(await svc.list()); setOpen(true) } else setOpen(false) }
  useEffect(() => { refresh(); api?.vaultStatus?.().then((s: any) => setOldVault(!!s?.exists)).catch(() => {}) }, [])
  const touch = () => { clearTimeout(timer.current); if (svc.unlocked) timer.current = setTimeout(() => { svc.lock(); setShown([]); setForm(null); setOpen(false) }, mins * 60000) }
  useEffect(() => { touch(); return () => clearTimeout(timer.current) }, [open, mins, list, form])
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f() } catch (e: any) { setMsg(String(e.message || e)) } finally { setBusy(false) } }
  const setup = () => run(async () => { if (pw.length < 10) return setMsg(T('vaultShort')); if (pw !== pw2) return setMsg(T('vaultMismatch')); await svc.setup(pw); setPw(''); setPw2(''); setMsg(''); await refresh() })
  const unlock = () => run(async () => { if (await svc.unlock(pw)) { setPw(''); setMsg(''); await refresh() } else setMsg(T('vaultWrong')) })
  const importOld = () => run(async () => { // desktop only: copy entries from the previous (scrypt) vault into the unified one, same master password
    if (!(await svc.exists())) { if (pw.length < 10) return setMsg(T('vaultShort')); await svc.setup(pw) } else if (!svc.unlocked && !(await svc.unlock(pw))) return setMsg(T('vaultWrong'))
    if (!(await api.vaultUnlock(pw))) return setMsg(T('vaultWrong')); const old = await api.vaultList(); for (const e of old) await svc.save({ ...empty(), ...e, id: undefined, tags: Array.isArray(e.tags) ? e.tags.join(', ') : e.tags || '' }); await api.vaultLock(); setPw(''); onToast(`${T('vaultOldOk')}: ${old.length}`); await refresh()
  })
  const save = () => run(async () => {
    const e = form!; if (!e.name.trim()) return
    const dup = list.find((x) => x.id !== e.id && hostOf(x.url) && hostOf(x.url) === hostOf(e.url) && (x.username || x.email) === (e.username || e.email)); if (dup && !confirm(T('dupWarn'))) return
    await svc.save(e); setForm(null); await refresh()
  })
  const download = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(await svc.exportBackup())], { type: 'application/json' })); a.download = 'madar-vault-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); onToast(T('vaultSaved')) }
  const restore = (f?: File) => f && run(async () => { if (!confirm('⚠ ' + T('vaultRestore'))) return; await svc.importBackup(JSON.parse(await f.text())); setMsg(T('vaultRestoreOk')); await refresh() })
  const f = (k: keyof Entry) => (e: any) => setForm({ ...form!, [k]: e.target.value })
  const rows = useMemo(() => list.filter((e) => !q || [e.name, e.url, e.username, e.email, e.tags].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [list, q])
  const copy = (v: string) => copySecret(v).then(() => onToast(T('copied'))).catch(() => {})
  const age = (e: Entry) => Math.floor((Date.now() - (e.updated || e.created || Date.now())) / 864e5)
  return (
    <div className="m-modal" onClick={onClose}><div className="m-card vault" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T('vault')}>
      <div className="m-row between"><h3>🔐 {T('vault')}</h3><button onClick={onClose} aria-label={T('close')}>✕</button></div>
      <p className="m-muted m-small">{T('vaultNoAudit')}</p>
      {exists === null ? null : !exists ? (<>
        <p className="m-muted">{T('vaultSetup').replace(/\*\*/g, '')}</p>
        <input type="password" placeholder={T('vaultPw')} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input type="password" placeholder={T('vaultPw2')} value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setup()} autoComplete="new-password" />
        <button className="primary" disabled={busy} onClick={setup}>{busy ? '…' : T('vaultCreate')}</button>
        {oldVault && <button disabled={busy} onClick={importOld}>{T('vaultOld')}</button>}
        <button onClick={() => file.current?.click()}>{T('vaultRestore')}</button></>
      ) : !open ? (<>
        <input autoFocus type="password" placeholder={T('vaultPw')} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} autoComplete="current-password" />
        <button className="primary" disabled={busy} onClick={unlock}>{busy ? '…' : T('vaultUnlock')}</button>
        {oldVault && <button disabled={busy} onClick={importOld}>{T('vaultOld')}</button>}
        <button onClick={() => file.current?.click()}>{T('vaultRestore')}</button></>
      ) : form ? (<>
        <h4>{form.id ? T('vaultEdit') : T('vaultNew')}</h4>
        {([['name', 'vaultService'], ['url', 'url'], ['username', 'vaultUser'], ['email', 'vaultEmail'], ['recovery', 'vaultRecovery'], ['tags', 'tags']] as [keyof Entry, string][]).map(([k, l]) => <label key={k}>{T(l)}<input dir={k === 'url' || k === 'email' ? 'ltr' : 'auto'} value={(form[k] as string) || ''} onChange={f(k)} /></label>)}
        <label>{T('vaultPass')}<div className="m-row"><input dir="ltr" type={shown.includes('form') ? 'text' : 'password'} value={form.password} onChange={f('password')} autoComplete="off" /><button onClick={() => setShown(shown.includes('form') ? shown.filter((x) => x !== 'form') : [...shown, 'form'])} aria-label={T('reveal')}>👁</button></div></label>
        <div className="m-muted m-small">{strength(form.password).label} · ~{strength(form.password).bits} bits</div>
        <div className="m-row"><input type="number" min={8} max={64} value={len} onChange={(e) => setLen(+e.target.value)} style={{ width: 70 }} />{POOL_KEYS.map((k) => <label key={k} className="chk"><input type="checkbox" checked={sets.includes(k)} onChange={() => setSets(sets.includes(k) ? sets.filter((x) => x !== k) : [...sets, k])} />{k}</label>)}
          <button onClick={() => setForm({ ...form, password: genPw(Math.min(64, Math.max(8, len)), sets) })}>{T('generate')}</button></div>
        <label>{T('notes')}<textarea dir="auto" value={form.notes} onChange={f('notes')} /></label>
        <div className="m-row end"><button onClick={() => setForm(null)}>{T('cancel')}</button><button className="primary" onClick={save}>{T('save')}</button></div></>
      ) : (<>
        <div className="m-row"><input placeholder={T('vaultSearch')} dir="auto" value={q} onChange={(e) => setQ(e.target.value)} /><button className="primary" style={{ flex: '0 0 auto' }} onClick={() => setForm(empty())}>＋ {T('vaultNew')}</button></div>
        <div className="vlist">{rows.map((e) => (
          <div key={e.id} className="ventry"><div className="vmain"><b dir="auto">{e.name}</b><div className="m-muted m-small" dir="auto">{e.username || e.email} {e.url && `· ${hostOf(e.url)}`} {age(e) > 180 && ' · ' + T('oldPw')}</div><div className="m-muted m-small" dir="ltr">{shown.includes(e.id) ? e.password : '••••••••••'}</div></div>
            <div className="m-row vact">
              {linkBodyId && <button className={linkedIds.includes(e.id) ? 'on' : ''} onClick={() => onLink(e.id, !linkedIds.includes(e.id))}>{linkedIds.includes(e.id) ? T('unlink') : T('link')}</button>}
              <button aria-label={T('copyUser')} title={T('copyUser')} onClick={() => copy(e.username || e.email)}>👤</button><button aria-label={T('copyPass')} title={T('copyPass')} onClick={() => copy(e.password)}>🔑</button>
              <button aria-label={T('reveal')} onClick={() => setShown(shown.includes(e.id) ? shown.filter((x) => x !== e.id) : [...shown, e.id])}>👁</button><button onClick={() => setForm(e)}>✎</button>
              {e.url && <button aria-label={T('openSite')} onClick={() => openUrl(/^https?:/i.test(e.url) ? e.url : 'https://' + e.url)}>↗</button>}
              <button className="danger" onClick={() => confirm(`${T('del')}: ${e.name}?`) && run(async () => { await svc.remove(e.id); await refresh() })}>🗑</button></div></div>))}
          {!rows.length && <p className="m-muted">—</p>}</div>
        <div className="m-row between"><label className="chk">{T('autolock')}<select value={mins} onChange={(e) => { setMins(+e.target.value); localStorage.setItem('autolock', e.target.value) }}>{[1, 5, 15, 30].map((m) => <option key={m} value={m}>{m} {T('min')}</option>)}</select></label>
          <button onClick={() => run(download)}>{T('vaultBackup')}</button><button onClick={() => { svc.lock(); setShown([]); setOpen(false) }}>{T('vaultLock')}</button></div></>)}
      {msg && <p className="warn">{msg}</p>}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} />
    </div></div>)
}
