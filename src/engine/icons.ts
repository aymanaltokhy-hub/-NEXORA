import * as THREE from 'three'
import { cssHex } from './color'
export interface IconBody { title: string; url: string; color: string; favicon: string | null }
const CELL = 64
/** Packs every link's round icon (site favicon, or its initial on the body colour) into one texture, so hundreds of icon-planets cost a single draw call. */
export class IconAtlas {
  canvas = document.createElement('canvas'); tex: THREE.CanvasTexture; cols: number; cap: number; cellUv: number; private ctx: CanvasRenderingContext2D
  private imgs = new Map<string, HTMLImageElement | null>()
  constructor(n: number, coarse: boolean) {
    const max = coarse ? 2048 : 4096, need = Math.ceil(Math.sqrt(Math.max(1, n))); let size = CELL; while (size < need * CELL && size < max) size *= 2
    this.canvas.width = this.canvas.height = size; this.cols = size / CELL; this.cap = this.cols * this.cols; this.cellUv = CELL / size; this.ctx = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.flipY = false; this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4
  }
  uv(i: number): [number, number] { return i >= this.cap ? [-1, -1] : [(i % this.cols) * this.cellUv, Math.floor(i / this.cols) * this.cellUv] }
  private img(src: string, redraw: () => void) {
    if (this.imgs.has(src)) return this.imgs.get(src) || null
    this.imgs.set(src, null); const im = new Image(); im.onload = () => { this.imgs.set(src, im); redraw() }; im.src = src; return null
  }
  draw(i: number, b: IconBody) {
    if (i >= this.cap) return
    const x = (i % this.cols) * CELL, y = Math.floor(i / this.cols) * CELL, c = this.ctx, col = cssHex(b.color), cx = x + CELL / 2, cy = y + CELL / 2
    c.save(); c.clearRect(x, y, CELL, CELL); c.beginPath(); c.arc(cx, cy, 31, 0, 6.2832); c.fillStyle = col; c.fill()          // coloured rim = the body colour
    const im = b.favicon ? this.img(b.favicon, () => { this.draw(i, b); this.tex.needsUpdate = true }) : null
    if (im) { c.beginPath(); c.arc(cx, cy, 25, 0, 6.2832); c.fillStyle = '#ffffff'; c.fill(); c.save(); c.beginPath(); c.arc(cx, cy, 24, 0, 6.2832); c.clip(); c.drawImage(im, cx - 18, cy - 18, 36, 36); c.restore() }
    else { c.beginPath(); c.arc(cx, cy, 26, 0, 6.2832); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke()
      let host = ''; try { host = new URL(b.url).hostname.replace(/^www\./, '') } catch {}
      const ch = ([...(b.title || host || '?').trim()].find((k) => /\p{L}|\p{N}/u.test(k)) || '?').toUpperCase()
      c.fillStyle = '#ffffff'; c.font = '700 32px "Segoe UI",Tahoma,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, cx, cy + 2) }
    c.restore(); this.tex.needsUpdate = true
  }
  dispose() { this.tex.dispose() }
}
