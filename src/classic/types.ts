export type Kind = 'link' | 'zone' | 'stroke' | 'text'
export type Obj = {
  id: string; type: Kind; x: number; y: number; w: number; h: number; rotation: number; z: number; locked?: boolean
  title?: string; url?: string; favicon?: string | null; color?: string; fav?: boolean; tags?: string[]; notes?: string
  shape?: 'rect' | 'round' | 'ellipse' | 'poly'; opacity?: number; stroke?: string; strokeWidth?: number
  mode?: 'visual' | 'container'; points?: number[]
  text?: string; fontSize?: number; bold?: boolean; italic?: boolean; textColor?: string; bg?: string; align?: string
}
export type VP = { x: number; y: number; scale: number }
