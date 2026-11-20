import { supabase } from '@/lib/supabase'
import type { WorldId } from '@/types/domain'

const BUCKET = 'media'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Matches the bucket limit set in the database. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
}

export function publicMediaUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * Uploads one file into the signed-in user's folder and returns its public URL.
 * Uses XHR rather than fetch because only XHR reports upload progress.
 * Paths are unique, so the CDN may cache each file for a year.
 */
export async function uploadMedia(file: Blob, userId: string, onProgress?: (fraction: number) => void): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Your session expired. Sign in again to publish.')

  const extension = EXTENSIONS[file.type] ?? 'mp4'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.setRequestHeader('apikey', SUPABASE_KEY)
    request.setRequestHeader('Content-Type', file.type || 'video/mp4')
    request.setRequestHeader('cache-control', 'max-age=31536000')
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(uploadErrorMessage(request.status)))
    }
    request.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'))
    request.send(file)
  })

  return publicMediaUrl(path)
}

function uploadErrorMessage(status: number): string {
  if (status === 413) return 'This video is larger than 50 MB. Record a shorter take or trim it first.'
  if (status === 415) return 'This file type is not supported. Use an MP4, MOV or WebM video.'
  if (status === 401 || status === 403) return 'Your session expired. Sign in again to publish.'
  return 'The upload failed. Try again in a moment.'
}

export interface NewEntry {
  authorId: string
  caption: string
  worldId: WorldId
  videoUrl: string
  posterUrl: string | null
  width: number
  height: number
  durationMs: number
  answersEntryId?: string | null
  clashId?: string | null
}

export async function publishEntry(entry: NewEntry): Promise<string> {
  const { data, error } = await supabase
    .from('entries')
    .insert({
      author_id: entry.authorId,
      caption: entry.caption.trim(),
      world_id: entry.worldId,
      video_url: entry.videoUrl,
      poster_url: entry.posterUrl,
      width: entry.width,
      height: entry.height,
      duration_ms: entry.durationMs,
      answers_entry_id: entry.answersEntryId ?? null,
      clash_id: entry.clashId ?? null,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('You already entered this Clash.')
    if (error.code === '42501') throw new Error('This Clash is not taking entries right now.')
    throw error
  }
  return data.id as string
}
