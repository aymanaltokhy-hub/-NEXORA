import * as THREE from 'three'
/** Accepts #hex and both `hsl(h, s%, l%)` and `hsl(h s% l%)`; always interpreted as sRGB like CSS. */
export const toColor = (v: string) => {
  const c = new THREE.Color(), m = /^hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/i.exec(v || '')
  if (m) return c.setHSL(+m[1] / 360, +m[2] / 100, +m[3] / 100, THREE.SRGBColorSpace)
  try { c.set(v) } catch { c.set('#6c8cff') } return c
}
export const cssHex = (v: string) => '#' + toColor(v).getHexString()
