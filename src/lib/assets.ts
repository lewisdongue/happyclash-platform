import type { WorldId } from '@/types/domain'

const ASSETS = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/assets`

export type ModelKey = WorldId | 'trophy' | 'pet-dog' | 'pet-cat' | 'pet-rabbit'

/** 3D models from Sketchfab, stored in the public `assets` bucket and cached for a year. */
export const MODEL_URL: Record<ModelKey, string> = {
  music: `${ASSETS}/models/music.glb`,
  dance: `${ASSETS}/models/dance-v2.glb`,
  sport: `${ASSETS}/models/sport.glb`,
  comedy: `${ASSETS}/models/comedy.glb`,
  art: `${ASSETS}/models/art-v2.glb`,
  tech: `${ASSETS}/models/tech-v2.glb`,
  lifestyle: `${ASSETS}/models/lifestyle.glb`,
  innovation: `${ASSETS}/models/innovation.glb`,
  animals: `${ASSETS}/models/pet-dog.glb`,
  'pet-dog': `${ASSETS}/models/pet-dog.glb`,
  'pet-cat': `${ASSETS}/models/pet-cat.glb`,
  'pet-rabbit': `${ASSETS}/models/pet-rabbit.glb`,
  trophy: `${ASSETS}/models/trophy.glb`,
}

export interface ModelCredit {
  key: ModelKey
  title: string
  author: string
  url: string
}

/** Every model is licensed CC BY 4.0; the license asks for this attribution. */
export const MODEL_CREDITS: ModelCredit[] = [
  { key: 'music', title: 'microphone', author: 'ssmilerok', url: 'https://sketchfab.com/models/545b82406abf465cb0fd91a4be42ac05' },
  { key: 'dance', title: 'Disco Ball', author: 'MozillaHubs', url: 'https://sketchfab.com/models/ff4fcb7af1e248c2964c18e8779f1bd7' },
  { key: 'sport', title: 'Low Poly Cartoon Football Ball Free', author: 'chroma3d', url: 'https://sketchfab.com/models/259ba8af81484d19861fd5d70e9f5fcc' },
  { key: 'comedy', title: 'Terracotta Theatrical Mask', author: 'yugengen', url: 'https://sketchfab.com/models/49d586034c274bf38feb72d159fd61c5' },
  { key: 'art', title: 'Pintura / painting', author: 'jenny_494', url: 'https://sketchfab.com/models/0b82e692d1a34066814e45e267d716d6' },
  { key: 'tech', title: 'Futuristic flying animated Robot - Low Poly', author: 'Shayan', url: 'https://sketchfab.com/models/c5b92c281dc444448e64c0607719c7a2' },
  { key: 'lifestyle', title: 'Mustang Sunglasses - MU 1683', author: 'Berk Gedik', url: 'https://sketchfab.com/models/eeec9fbb427246959acee4e4266b0f0a' },
  { key: 'innovation', title: 'Edison Light Bulb', author: 'Fishboe', url: 'https://sketchfab.com/models/aeb0e4832f04463280510e550e2cdbd5' },
  { key: 'animals', title: 'Dog Puppy', author: 'kenchoo', url: 'https://sketchfab.com/models/72331763040e4314b154f84348fe0957' },
  { key: 'pet-cat', title: 'Toon Cat FREE', author: 'omabuarts', url: 'https://sketchfab.com/models/b2bd1ee7858444bda366110a2d960386' },
  { key: 'pet-rabbit', title: 'Cute Bunny', author: 'minimoku', url: 'https://sketchfab.com/models/7d30845d69c4474ebeddd177df6b7f02' },
  { key: 'trophy', title: 'Gold Trophy Cup', author: 'klrxyz', url: 'https://sketchfab.com/models/796aa0c9c5d5420c975a8e613a80066d' },
]
