/** Models for the Life world, from Sketchfab (CC BY 4.0), stored in the public `assets` bucket. */
const ASSETS = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/assets/models`

export const LIFE_MODELS = {
  car: "/life/car.glb",
  trees: `${ASSETS}/life-trees.glb`,
  buildings: [1, 2, 3, 4, 5, 6].map((index) => `${ASSETS}/life-building-${index}.glb`),
  arena: `${ASSETS}/life-arena.glb`,
  theater: `${ASSETS}/life-theater.glb`,
  people: `${ASSETS}/life-people.glb`,
  /** Scanned people: one dresses the crowds (street and halls), the other is the visitor. */
  crowd: '/life/crowd.glb',
  player: '/life/player.glb',
}

export const LIFE_CREDITS = [
  { title: 'Generic Sedan', author: 'ahadika', url: 'https://sketchfab.com/models/7f0b6a69c76141418f1a0b695eee22ee' },
  { title: 'Trees Low Poly', author: 'Igor_K.', url: 'https://sketchfab.com/models/1d2dcca2ccb1496c85b7cc5789a2a261' },
  { title: 'Low rise wall to wall office building', author: 'aitortilla01', url: 'https://sketchfab.com/models/dcf171dca9174000a0fa8d44660253d0' },
  { title: 'Mid rise wall to wall office building', author: 'aitortilla01', url: 'https://sketchfab.com/models/4d2c3f3450ef4e849056b88b49873ce2' },
  { title: 'Hi rise apartment building', author: 'aitortilla01', url: 'https://sketchfab.com/models/f8c0a550cd1e441f85b46caeba6632f3' },
  { title: 'New York styled hi rise apartment building', author: 'aitortilla01', url: 'https://sketchfab.com/models/14e3d5743f7546d5bb7f3befc72c9057' },
  { title: 'Low rise department store building', author: 'aitortilla01', url: 'https://sketchfab.com/models/fbf28e40ff7b409191b2082497f29aeb' },
  { title: 'W2W building with 45 degree angle', author: 'aitortilla01', url: 'https://sketchfab.com/models/3aa1ea0087e448d7beb1c91e5b9d8eb0' },
  { title: 'Eden Arena', author: 'Karpulya', url: 'https://sketchfab.com/models/8f1caa3250424e8e8769a405f1194468' },
  { title: 'Theater Model', author: 'sl.gandini', url: 'https://sketchfab.com/models/734703d44dde46f39fd73d51d85b8821' },
  { title: 'Low Poly People Pack (Male)', author: 'Ujjwal-Chauhan', url: 'https://sketchfab.com/models/aa504198c0514c4e8f7945985f2e9128' },
]
