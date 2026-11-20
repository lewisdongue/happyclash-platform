/** Free garage: what the visitor can drive. Stats are arcade-tuned, not physical. */
export interface Vehicle {
  id: 'coupe' | 'suv' | 'moto'
  maxForward: number
  scale: [number, number, number]
}
export const VEHICLES: Vehicle[] = [
  { id: 'coupe', maxForward: 26, scale: [1, 1, 1] },
  { id: 'suv', maxForward: 21, scale: [1.12, 1.3, 1.08] },
  { id: 'moto', maxForward: 32, scale: [0.34, 0.85, 0.62] },
]
export const OUTFITS = ['#ec5d9e', '#2f6fbf', '#ffd54f', '#6a5ba8', '#f5f5f5', '#1c1c22']


/** What the visitor picked in the shop, kept on this device. Everything is free. */
export interface Garage {
  vehicle: Vehicle['id']
  paint: string
  outfit: string
}
const KEY = 'hc:life-garage'
export function loadGarage(): Garage {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Garage | null
    if (saved?.vehicle) return saved
  } catch {
    /* storage unavailable */
  }
  return { vehicle: 'coupe', paint: '', outfit: OUTFITS[0] }
}
export function saveGarage(garage: Garage) {
  try {
    localStorage.setItem(KEY, JSON.stringify(garage))
  } catch {
    /* storage unavailable */
  }
}
