import { useEffect, useState } from 'react'
export function probeWebGL() {
  try {
    const c = document.createElement('canvas'), gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return { ok: false, renderer: '', software: false, version: '' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    return { ok: true, renderer, software: /swiftshader|llvmpipe|software|basic render|softpipe/i.test(renderer), version: String(gl.getParameter(gl.VERSION)) }
  } catch { return { ok: false, renderer: '', software: false, version: '' } }
}
export default function Diagnostics({ onClose }: { onClose: () => void }) {
  const [gl] = useState(probeWebGL), [info, setInfo] = useState<any>(null)
  useEffect(() => { (window as any).api?.gfxInfo?.().then(setInfo) }, [])
  const text = JSON.stringify({ webgl: gl, desktop: info, ua: navigator.userAgent, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }, null, 2)
  return (
    <div className="m-modal" onClick={onClose}><div className="m-card" onClick={(e) => e.stopPropagation()} dir="ltr">
      <h3>Diagnostics</h3>
      <p>WebGL: <b>{gl.ok ? 'available' : 'UNAVAILABLE'}</b>{gl.ok && <> · {gl.renderer} {gl.software && <span className="warn">(software rendering — 3D will be slow)</span>}</>}</p>
      {info && <p>Desktop graphics mode: <b>{info.software ? 'software (forced)' : 'hardware'}</b>{' '}
        <button onClick={() => confirm('MADAR will restart.') && (window as any).api.gfxSet(!info.software)}>{info.software ? 'Use hardware' : 'Force software'}</button></p>}
      <pre>{text}</pre>
      <div className="m-row"><button onClick={() => navigator.clipboard.writeText(text)}>Copy</button><button onClick={onClose}>Close</button></div>
    </div></div>)
}
