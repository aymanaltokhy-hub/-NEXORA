import { useMemo } from 'react'
import type { Body, Scene } from '../model/types'
import type { Sel } from '../engine/Engine'
import { t, type Lang } from '../i18n'
export default function ListView({ scene, q, sel, onSelect, lang }: { scene: Scene; q: string; sel: Sel; onSelect(s: Sel): void; lang: Lang }) {
  const bySys = useMemo(() => { const m = new Map<string, Body[]>(); scene.bodies.forEach((b) => (m.get(b.systemId) || m.set(b.systemId, []).get(b.systemId)!).push(b)); return m }, [scene.bodies])
  const needle = q.trim().toLowerCase(), match = (b: Body) => !needle || [b.title, b.url, ...b.tags].join(' ').toLowerCase().includes(needle)
  return (
    <main className="m-list" aria-label={t(lang, 'systems')}>
      {!scene.systems.length && <p className="m-muted">{t(lang, 'none')}</p>}
      {scene.systems.map((s) => { const items = (bySys.get(s.id) || []).filter(match); if (needle && !items.length) return null
        return (<details key={s.id} open={!!needle || scene.systems.length < 4}><summary><i style={{ background: s.color }} /><span dir="auto">{s.inbox ? t(lang, 'inbox') : s.name}</span>
          <button className="m-mini" onClick={(e) => { e.preventDefault(); onSelect({ kind: 'system', id: s.id }) }} aria-label={`${t(lang, 'system')}: ${s.name}`}>⌖</button><em>{items.length}</em></summary>
          {!items.length && <p className="m-muted">{t(lang, 'empty')}</p>}
          <ul>{items.map((b) => <li key={b.id}><button className={sel?.id === b.id ? 'on' : ''} onClick={() => onSelect({ kind: 'body', id: b.id })}><i style={{ background: b.color }} /><span dir="auto">{b.fav ? '★ ' : ''}{b.title}</span></button></li>)}</ul></details>) })}
    </main>)
}
