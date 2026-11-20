import type { TalentWorld, WorldId } from '@/types/domain'

/** Every Talent World has its own color. The UI adopts it while you watch. */
export const WORLDS: Record<WorldId, TalentWorld> = {
  music: { id: 'music', name: 'Music', accent: '#FFD54F', accentDeep: '#FF9F43', onAccent: '#1A1406', scene: '#2B2214' },
  dance: { id: 'dance', name: 'Dance', accent: '#FF6FB1', accentDeep: '#C2378A', onAccent: '#1A0612', scene: '#2E1426' },
  sport: { id: 'sport', name: 'Sport', accent: '#6FB8FF', accentDeep: '#2F6FBF', onAccent: '#06101A', scene: '#13223A' },
  comedy: { id: 'comedy', name: 'Comedy', accent: '#B9A6FF', accentDeep: '#6A5BA8', onAccent: '#120B26', scene: '#1F1838' },
  art: { id: 'art', name: 'Art', accent: '#5FE0A8', accentDeep: '#1F9E6E', onAccent: '#04180F', scene: '#10261D' },
  tech: { id: 'tech', name: 'Tech', accent: '#7FE7F2', accentDeep: '#2BA3B8', onAccent: '#041519', scene: '#0F2228' },
  lifestyle: { id: 'lifestyle', name: 'Lifestyle', accent: '#FF9A76', accentDeep: '#E0603C', onAccent: '#1F0A04', scene: '#2E1A14' },
  innovation: { id: 'innovation', name: 'Innovation', accent: '#C6F36B', accentDeep: '#7FB52A', onAccent: '#121A04', scene: '#1A2410' },
  animals: { id: 'animals', name: 'Animals', accent: '#FFB86B', accentDeep: '#D9822B', onAccent: '#1F1204', scene: '#2B1D10' },
}

export const WORLD_LIST = Object.values(WORLDS)

/** Converts a hex color to an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
