export const SCHEMA = 1
export type Vec3 = [number, number, number]
export interface Orbit { radius: number; angle: number; speed: number; incl: number; node: number }
export interface Body {
  id: string; systemId: string; title: string; url: string; favicon: string | null; color: string; size: number
  fav: boolean; tags: string[]; notes: string; orbit: Orbit; legacyId?: string; created: number
}
export interface System { id: string; name: string; color: string; x: number; y: number; z: number; radius: number; inbox?: boolean; legacyId?: string }
export interface Settings {
  background: { preset: 'black' | 'stars' | 'nebula'; color: string; starDensity: number; effects: number; imageId: string | null }
  motion: { enabled: boolean; speed: number }
  camera: { pos: Vec3; target: Vec3 }
}
export interface Report { systems: number; bodies: number; inbox: number; emptySystems: number; legacyKept: { strokes: number; texts: number } }
export interface Scene { schema: number; systems: System[]; bodies: Body[]; settings: Settings; migration?: { from: 'nexora2d'; at: number; report: Report } }
export const defaultSettings = (): Settings => ({
  background: { preset: 'stars', color: '#070A12', starDensity: 0.5, effects: 0.4, imageId: null },
  motion: { enabled: true, speed: 1 }, camera: { pos: [0, 40, 90], target: [0, 0, 0] }
})
export const emptyScene = (): Scene => ({ schema: SCHEMA, systems: [], bodies: [], settings: defaultSettings() })
