import { useMemo, useState } from 'react'
const hsl = (h: number, s: number, l: number) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12, c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0') }; return `#${f(0)}${f(8)}${f(4)}` }
const HUES = [0, 16, 30, 45, 60, 85, 125, 150, 170, 190, 210, 230, 255, 275, 300, 325]
/** 72 swatches (16 hues x 4 shades + 8 neutrals) plus a free colour picker and HEX field. */
export const PALETTE = [...[34, 48, 62, 76].flatMap((l) => HUES.map((h) => hsl(h, l >= 62 ? 82 : 76, l))), ...[0, 14, 28, 42, 58, 72, 86, 100].map((l) => hsl(0, 0, l))]
export const toHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#6c8cff')
export default function ColorField({ label, value, onChange, custom, palette }: { label: string; value: string; onChange(c: string): void; custom: string; palette: string }) {
  const [open, setOpen] = useState(false), grid = useMemo(() => PALETTE, [])
  return (
    <div className="m-cf"><span className="m-cf-l">{label}</span>
      <div className="m-row"><button className="m-cf-sw" style={{ background: toHex(value) }} aria-label={`${label}: ${value}`} aria-expanded={open} onClick={() => setOpen(!open)} />
        <input type="color" aria-label={custom} value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
        <input className="m-cf-hex" dir="ltr" key={value} defaultValue={toHex(value)} aria-label="HEX" onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()} /></div>
      {open && <div className="m-cf-grid" role="listbox" aria-label={palette}>{grid.map((c) => <button key={c} role="option" aria-selected={c === value} className={c.toLowerCase() === value.toLowerCase() ? 'on' : ''} style={{ background: c }} aria-label={c} onClick={() => onChange(c)} />)}</div>}
    </div>)
}
