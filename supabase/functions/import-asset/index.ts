// Copies a 3D model from a Sketchfab download link into the public `assets`
// bucket. Used by the team when adding models; each call needs a ticket
// created in the database a few minutes before.

import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { ticket, source, path } = await request.json()
    if (typeof path !== 'string' || !/^models\/[a-z0-9-]+\.glb$/.test(path)) return reply({ error: 'bad_path' }, 400)
    const source_url = new URL(source)
    if (!['sketchfab-prod-media.s3.amazonaws.com'].includes(source_url.hostname) && !source_url.hostname.endsWith('.sketchfab.com')) return reply({ error: 'bad_source' }, 400)

    const { data: valid } = await db.from('asset_import_tickets').select('token').eq('token', ticket).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (!valid) return reply({ error: 'bad_ticket' }, 403)

    const file = await fetch(source_url)
    if (!file.ok) return reply({ error: 'download_failed' }, 502)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error } = await db.storage.from('assets').upload(path, bytes, { contentType: 'model/gltf-binary', upsert: true, cacheControl: '31536000' })
    if (error) return reply({ error: error.message }, 500)
    return reply({ ok: true, path, size: bytes.byteLength })
  } catch (error) {
    return reply({ error: String(error) }, 500)
  }
})
