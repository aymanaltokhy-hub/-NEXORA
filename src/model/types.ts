export const SCHEMA = 1
export type Vec3 = [number, number, number]
export interface Orbit { radius: number; angle: number; speed: number; incl: number; node: number; ecc?: number; custom?: boolean } // speed sign = direction (+ clockwise seen from above); custom = positioned by the user, ignored by auto-layout
export interface Glow { color: string; intensity: number }
export interface Body {
  id: string; systemId: string; title: string; url: string; favicon: string | null; color: string; size: number
  fav: boolean; tags: string[]; notes: string; vaultIds?: string[]; glow?: Glow; orbit: Orbit; legacyId?: string; created: number
}
export interface System { id: string; name: string; color: string; x: number; y: number; z: number; radius: number; inbox?: boolean; legacyId?: string; glow?: Glow; radiusCustom?: boolean }
export const PRESETS = ['black', 'stars', 'nebula', 'galaxy', 'blackhole', 'solar', 'comets', 'cosmos'] as const
export type Preset = (typeof PRESETS)[number]
export interface Settings {
  background: { preset: Preset; color: string; starDensity: number; effects: number; imageId: string | null }
  motion: { enabled: boolean; speed: number }
  view?: { labels: 'near' | 'all' | 'off'; icons: boolean }
  camera: { pos: Vec3; target: Vec3; moved?: boolean }
}
export interface Report { systems: number; bodies: number; inbox: number; emptySystems: number; legacyKept: { strokes: number; texts: number } }
export interface Scene { schema: number; systems: System[]; bodies: Body[]; settings: Settings; migration?: { from: 'nexora2d'; at: number; report: Report } }
export const defaultSettings = (): Settings => ({
  background: { preset: 'stars', color: '#070A12', starDensity: 0.5, effects: 0.4, imageId: null },
  motion: { enabled: true, speed: 1 }, view: { labels: 'near', icons: true }, camera: { pos: [0, 40, 90], target: [0, 0, 0] }
})
export const emptyScene = (): Scene => ({ schema: SCHEMA, systems: [], bodies: [], settings: defaultSettings() })
