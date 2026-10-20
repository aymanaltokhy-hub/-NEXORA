import { useEffect, useRef } from 'react'
import { Engine, type Sel } from '../engine/Engine'
import type { Scene, Vec3 } from '../model/types'

export interface SpaceProps {
  scene: Scene; selection: Sel; mode: 'navigate' | 'move'; bottomInset: number; bgUrl: string | null; inboxName: string; engineRef: { current: Engine | null }
  onPick(s: Sel): void; onDouble(s: NonNullable<Sel>): void; onBodyDrop(bodyId: string, systemId: string | null): void
  onSystemMoved(id: string, p: Vec3, final: boolean): void; onCamera(c: { pos: Vec3; target: Vec3 }): void; onStatus(s: 'ok' | 'fail' | 'lost'): void
}
/** Hosts the Three.js engine. React only passes data in; all rendering lives in engine/. */
export default function Space(p: SpaceProps) {
  const host = useRef<HTMLDivElement>(null), cb = useRef(p); cb.current = p
  useEffect(() => {
    let e: Engine
    try {
      e = new Engine(host.current!, {
        onPick: (s) => cb.current.onPick(s), onDouble: (s) => cb.current.onDouble(s), onBodyDrop: (i, t) => cb.current.onBodyDrop(i, t),
        onSystemMoved: (...a) => cb.current.onSystemMoved(...a), onCamera: (c) => cb.current.onCamera(c),
        onLost: () => cb.current.onStatus('lost'), onRestored: () => cb.current.onStatus('ok')
      })
    } catch { cb.current.onStatus('fail'); return }
    p.engineRef.current = e; e.inboxName = cb.current.inboxName; e.setSettings(cb.current.scene.settings); e.setData(cb.current.scene)
    const cam = cb.current.scene.settings.camera; cam.moved ? e.setCamera(cam.pos, cam.target) : e.viewAll(true); cb.current.onStatus('ok')
    return () => { e.dispose(); p.engineRef.current = null }
  }, [])
  const e = () => p.engineRef.current
  useEffect(() => { const g = e(); if (g) { g.inboxName = p.inboxName; g.setData(p.scene) } }, [p.scene.systems, p.scene.bodies, p.inboxName])
  useEffect(() => { e()?.setSettings(p.scene.settings) }, [p.scene.settings.background, p.scene.settings.motion, p.scene.settings.view])
  useEffect(() => { e()?.setSelection(p.selection) }, [p.selection?.id, p.selection?.kind])
  useEffect(() => { e()?.setMode(p.mode) }, [p.mode])
  useEffect(() => { e()?.setInsets(p.bottomInset) }, [p.bottomInset])
  useEffect(() => { e()?.setBackgroundImage(p.bgUrl) }, [p.bgUrl])
  return <div ref={host} className="m-space" />
}
