import type { Obj } from '../classic/types'
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const SITES = ['github.com', 'youtube.com', 'notion.so', 'figma.com', 'drive.google.com', 'linkedin.com', 'gmail.com', 'canva.com', 'stackoverflow.com', 'wikipedia.org', 'news.ycombinator.com', 'medium.com']
const TITLES = ['GitHub', 'YouTube', 'Notion', 'Figma', 'Drive', 'LinkedIn', 'Gmail', 'Canva', 'Stack Overflow', 'ويكيبيديا', 'تقارير المشروع', 'مراجعة العقود', 'لوحة المهام', 'Design Review', 'دليل المكتب']
/** Deterministic NEXORA-2D-shaped demo data (zones of all shapes, links inside/outside, plus strokes/text) used by tests and the demo button. */
export function makeLegacyDemo(links = 300, zones = 6, seed = 7): Obj[] {
  const r = rng(seed), out: Obj[] = []; let z = 1
  const shapes: Obj['shape'][] = ['rect', 'round', 'ellipse', 'poly', 'rect', 'ellipse']
  for (let i = 0; i < zones; i++) {
    const w = 520 + r() * 160, h = 380 + r() * 120, x = (i % 3) * 760, y = Math.floor(i / 3) * 620, shape = shapes[i % shapes.length]
    const pts = shape === 'poly' ? [0, 40, w * 0.5, 0, w, 60, w * 0.9, h, w * 0.1, h * 0.9] : undefined
    out.push({ id: 'z' + i, type: 'zone', x, y, w, h, rotation: 0, z: z++, shape, title: ['Work', 'عمل', 'Learning', 'مشاريع', 'Tools', 'مراجع'][i % 6], color: ['#6C8CFF', '#45D6B5', '#F5B83D', '#E4608A', '#9B7BFF', '#4CC9F0'][i % 6], points: pts, mode: i % 2 ? 'container' : 'visual' })
  }
  for (let i = 0; i < links; i++) {
    const zi = Math.floor(r() * zones), zone = out[zi], outside = r() < 0.15
    const px = outside ? -600 + r() * 300 : zone.x + zone.w * (0.25 + r() * 0.5), py = outside ? r() * 800 : zone.y + zone.h * (0.3 + r() * 0.4), site = SITES[i % SITES.length]
    out.push({ id: 'l' + i, type: 'link', x: px, y: py, w: 190, h: 56, rotation: 0, z: z++, url: `https://${site}/p${i}`, title: `${TITLES[i % TITLES.length]} ${i}`, favicon: null, fav: i % 17 === 0, tags: i % 5 === 0 ? ['demo'] : [] })
  }
  for (let i = 0; i < 8; i++) out.push({ id: 's' + i, type: 'stroke', x: 100 * i, y: 50, w: 80, h: 20, rotation: 0, z: z++, points: [0, 0, 80, 20], stroke: '#6C8CFF', strokeWidth: 3 })
  for (let i = 0; i < 4; i++) out.push({ id: 't' + i, type: 'text', x: 150 * i, y: 900, w: 200, h: 30, rotation: 0, z: z++, text: 'Note ' + i, fontSize: 20 })
  return out
}
