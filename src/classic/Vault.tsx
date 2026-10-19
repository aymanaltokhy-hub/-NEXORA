import { useEffect, useState } from 'react'
import { useStore } from './store'
const POOLS: any = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', sym: '!@#$%^&*()-_=+[]{};:,.?' }
export function genPw(len: number, sets: string[]) {
  const pool = sets.map((k) => POOLS[k]).join('') || POOLS.lower, max = Math.floor(0x100000000 / pool.length) * pool.length; let out = ''
  while (out.length < len) { const a = new Uint32Array(len); crypto.getRandomValues(a); for (const v of a) if (v < max && out.length < len) out += pool[v % pool.length] }
  return out
}
export function strength(pw: string) {
  const pool = (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/\d/.test(pw) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(pw) ? 28 : 0)
  const bits = pw.length * Math.log2(Math.max(pool, 1)); return { bits: Math.round(bits), label: bits < 40 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Good' : 'Strong' }
}
const host = (u?: string) => { try { return new URL(/^https?:/i.test(u || '') ? u! : 'https://' + u).hostname.replace(/^www\./, '') } catch { return '' } }
const empty = () => ({ name: '', url: '', username: '', email: '', password: '', recovery: '', notes: '', tags: '', created: Date.now() })

export default function Vault() {
  const { vault, setVault } = useStore()
  const [st, setSt] = useState<any>(null), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [msg, setMsg] = useState('')
  const [list, setList] = useState<any[]>([]), [q, setQ] = useState(vault.filter), [form, setForm] = useState<any>(null), [shown, setShown] = useState<string[]>([])
  const [len, setLen] = useState(20), [sets, setSets] = useState(['lower', 'upper', 'digits', 'sym'])
  const [mins, setMins] = useState(+(localStorage.getItem('autolock') || 5))
  const refresh = async () => { const s = await window.api.vaultStatus(); setSt(s); setList(s.unlocked ? await window.api.vaultList() : []) }
  useEffect(() => { refresh(); window.api.onLocked(() => { setShown([]); setForm(null); refresh() }) }, [])
  const unlock = async () => { if (await window.api.vaultUnlock(pw)) { await window.api.vaultAutolock(mins); setPw(''); setMsg(''); refresh() } else setMsg('Wrong master password') }
  const setup = async () => {
    if (pw.length < 10) return setMsg('Use at least 10 characters'); if (pw !== pw2) return setMsg('Passwords do not match')
    if (await window.api.vaultSetup(pw)) { await window.api.vaultAutolock(mins); setPw(''); setPw2(''); setMsg(''); refresh() }
  }
  const save = async () => {
    const e = { ...form }; if (!e.name.trim()) return setMsg('Name is required')
    const dup = list.find((x) => x.id !== e.id && host(x.url) && host(x.url) === host(e.url) && (x.username || x.email) === (e.username || e.email))
    if (dup && !confirm('An entry for this site and account already exists. Save anyway?')) return
    await window.api.vaultSave(e); setForm(null); setMsg(''); refresh()
  }
  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value })
  const shownList = list.filter((e) => !q || [e.name, e.url, e.username, e.email, e.tags].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const age = (e: any) => Math.floor((Date.now() - (e.updated || e.created || Date.now())) / 864e5)
  return (
    <div className="modal" onClick={() => setVault(false)}><div className="vault" onClick={(e) => e.stopPropagation()}>
      <div className="row between"><h3>🔐 Secure Vault</h3><button onClick={() => setVault(false)}>✕</button></div>
      {!st ? null : !st.exists ? (<>
        <p className="muted">Create a master password. It encrypts everything here and <b>cannot be recovered</b> if you lose it.</p>
        <input type="password" placeholder="Master password (10+ chars)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" placeholder="Repeat" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setup()} />
        <button className="primary" onClick={setup}>Create vault</button></>
      ) : !st.unlocked ? (<>
        <input autoFocus type="password" placeholder="Master password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} />
        <button className="primary" onClick={unlock}>Unlock</button>
        <button onClick={async () => { const r = await window.api.vaultImport(); if (r) { setMsg('Backup restored. Unlock with the backup\'s master password.'); refresh() } }}>Restore encrypted backup…</button></>
      ) : form ? (<>
        <h4>{form.id ? 'Edit entry' : 'New entry'}</h4>
        {[['name', 'Service name'], ['url', 'Website URL'], ['username', 'Username'], ['email', 'Email'], ['recovery', 'Recovery email'], ['tags', 'Tags (comma separated)']].map(([k, l]) =>
          <label key={k}>{l}<input value={form[k] || ''} onChange={f(k)} /></label>)}
        <label>Password<div className="row"><input type={shown.includes('form') ? 'text' : 'password'} value={form.password} onChange={f('password')} />
          <button onClick={() => setShown(shown.includes('form') ? shown.filter((x) => x !== 'form') : [...shown, 'form'])}>👁</button></div></label>
        <div className="muted">Strength: {strength(form.password).label} (~{strength(form.password).bits} bits)</div>
        <div className="row"><input type="number" min={8} max={64} value={len} onChange={(e) => setLen(+e.target.value)} />
          {Object.keys(POOLS).map((k) => <label key={k} className="chk"><input type="checkbox" checked={sets.includes(k)} onChange={() => setSets(sets.includes(k) ? sets.filter((x) => x !== k) : [...sets, k])} />{k}</label>)}
          <button onClick={() => setForm({ ...form, password: genPw(len, sets) })}>Generate</button></div>
        <label>Notes<textarea value={form.notes || ''} onChange={f('notes')} /></label>
        <div className="row"><button onClick={() => setForm(null)}>Cancel</button><button className="primary" onClick={save}>Save</button></div></>
      ) : (<>
        <div className="row"><input placeholder="Search vault…" value={q} onChange={(e) => setQ(e.target.value)} /><button className="primary" onClick={() => setForm(empty())}>+ New</button></div>
        <div className="vlist">{shownList.map((e) => (
          <div key={e.id} className="ventry"><div><b>{e.name}</b><div className="muted">{e.username || e.email} {e.url && `· ${host(e.url)}`} {age(e) > 180 && '· ⚠ password older than 6 months'}</div>
            <div className="muted">{shown.includes(e.id) ? e.password : '••••••••••'}</div></div>
            <div className="row">
              <button title="Copy username" onClick={() => window.api.vaultCopy(e.username || e.email || '')}>👤</button>
              {e.email && e.username && <button title="Copy email" onClick={() => window.api.vaultCopy(e.email)}>✉</button>}
              <button title="Copy password (auto-clears)" onClick={() => window.api.vaultCopy(e.password)}>🔑</button>
              <button title="Reveal" onClick={() => setShown(shown.includes(e.id) ? shown.filter((x) => x !== e.id) : [...shown, e.id])}>👁</button>
              <button onClick={() => setForm(e)}>✎</button>
              {e.url && <button title="Open site" onClick={() => window.api.open(/^https?:/i.test(e.url) ? e.url : 'https://' + e.url)}>↗</button>}
              <button className="danger" onClick={() => confirm(`Delete "${e.name}"?`) && window.api.vaultDelete(e.id).then(refresh)}>🗑</button></div></div>))}
          {!shownList.length && <p className="muted">No entries.</p>}</div>
        <div className="row between"><label className="chk">Auto-lock
          <select value={mins} onChange={(e) => { setMins(+e.target.value); localStorage.setItem('autolock', e.target.value); window.api.vaultAutolock(+e.target.value) }}>
            {[1, 5, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
          <button onClick={async () => setMsg((await window.api.vaultExport()) ? 'Encrypted backup saved.' : '')}>Export encrypted backup</button>
          <button onClick={() => window.api.vaultLock()}>Lock now</button></div></>)}
      {msg && <p className="err">{msg}</p>}
    </div></div>)
}
