import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for Lumière cloud sync.
 *
 * IMPORTANT: The client is created LAZILY (on first access) to avoid
 * SSR crashes. @supabase/supabase-js references browser APIs that
 * don't exist during server-side rendering.
 */

let _supabase: SupabaseClient | null = null
let _initialized = false

function getSupabase(): SupabaseClient | null {
  if (_initialized) return _supabase
  _initialized = true

  if (typeof window === 'undefined') return null // SSR safety

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (url && key) {
    _supabase = createClient(url, key, {
      auth: { persistSession: false },
    })
  }
  return _supabase
}

export const isSupabaseEnabled = typeof window !== 'undefined' &&
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/**
 * Device-based auth: get or create a user row for this browser.
 * Returns the user ID for use in all subsequent queries.
 */
export async function getOrCreateUser(deviceKey: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null

  // Try to find existing user
  const { data: existing } = await sb
    .from('lumiere_users')
    .select('id')
    .eq('device_key', deviceKey)
    .single()

  if (existing) return existing.id

  // Create new user
  const { data: newUser, error } = await sb
    .from('lumiere_users')
    .insert({ device_key: deviceKey })
    .select('id')
    .single()

  if (error) {
    console.error('[supabase] Failed to create user:', error)
    return null
  }

  return newUser?.id || null
}

/**
 * Save the entire library state to Supabase.
 * Uses upsert semantics — replaces all data for this user.
 */
export async function syncToSupabase(
  userId: string,
  data: {
    folders: Array<Record<string, unknown>>
    files: Array<Record<string, unknown>>
    rawMetadata: Record<string, unknown>
    enrichment: Record<string, unknown>
    collections: Array<Record<string, unknown>>
  },
): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false

  try {
    // Delete old data
    await sb.from('lumiere_enrichment').delete().eq('user_id', userId)
    await sb.from('lumiere_collections').delete().eq('user_id', userId)
    await sb.from('lumiere_files').delete().eq('user_id', userId)
    await sb.from('lumiere_folders').delete().eq('user_id', userId)

    // Insert folders
    if (data.folders.length > 0) {
      const folders = data.folders.map((f) => ({
        id: f.id,
        user_id: userId,
        name: f.name,
        file_count: f.fileCount,
        has_fsa_handle: f.hasFsaHandle || false,
      }))
      await sb.from('lumiere_folders').upsert(folders)
    }

    // Insert files (batch of 500)
    if (data.files.length > 0) {
      const files = data.files.map((f) => ({
        id: f.id,
        user_id: userId,
        name: f.name,
        path: f.path,
        kind: f.kind,
        size: f.size,
        folder_id: f.folderId,
        metadata: data.rawMetadata[f.id] || null,
      }))
      for (let i = 0; i < files.length; i += 500) {
        await sb.from('lumiere_files').upsert(files.slice(i, i + 500))
      }
    }

    // Insert enrichment (batch)
    const enrichEntries = Object.entries(data.enrichment).map(([key, val]) => ({
      id: key,
      user_id: userId,
      data: val,
    }))
    for (let i = 0; i < enrichEntries.length; i += 500) {
      await sb.from('lumiere_enrichment').upsert(enrichEntries.slice(i, i + 500))
    }

    // Insert collections
    if (data.collections.length > 0) {
      const collections = data.collections.map((c) => ({
        id: c.id,
        user_id: userId,
        title: c.title,
        movie_ids: c.movieIds,
        cover_url: c.coverUrl,
        year: c.year,
      }))
      await sb.from('lumiere_collections').upsert(collections)
    }

    return true
  } catch (err) {
    console.error('[supabase] Sync failed:', err)
    return false
  }
}

/**
 * Load the entire library from Supabase.
 */
export async function loadFromSupabase(
  userId: string,
): Promise<{
  folders: Array<Record<string, unknown>>
  files: Array<Record<string, unknown>>
  rawMetadata: Record<string, unknown>
  enrichment: Record<string, unknown>
  collections: Array<Record<string, unknown>>
} | null> {
  const sb = getSupabase()
  if (!sb) return null

  try {
    const [foldersRes, filesRes, enrichRes, collectionsRes] = await Promise.all([
      sb.from('lumiere_folders').select('*').eq('user_id', userId),
      sb.from('lumiere_files').select('*').eq('user_id', userId),
      sb.from('lumiere_enrichment').select('*').eq('user_id', userId),
      sb.from('lumiere_collections').select('*').eq('user_id', userId),
    ])

    if (!foldersRes.data || foldersRes.data.length === 0) return null

    const folders = foldersRes.data.map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      fileCount: f.file_count,
      hasFsaHandle: f.has_fsa_handle,
    }))

    const files = (filesRes.data || []).map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      kind: f.kind,
      size: Number(f.size),
      folderId: f.folder_id,
    }))

    const rawMetadata: Record<string, unknown> = {}
    for (const f of (filesRes.data || []) as Array<Record<string, unknown>>) {
      if (f.metadata) rawMetadata[f.id as string] = f.metadata
    }

    const enrichment: Record<string, unknown> = {}
    for (const e of (enrichRes.data || []) as Array<Record<string, unknown>>) {
      enrichment[e.id as string] = e.data
    }

    const collections = (collectionsRes.data || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      title: c.title,
      movieIds: c.movie_ids,
      coverUrl: c.cover_url,
      year: c.year,
    }))

    return { folders, files, rawMetadata, enrichment, collections }
  } catch (err) {
    console.error('[supabase] Load failed:', err)
    return null
  }
}
