'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useLibrary } from '@/store/library'
import {
  isSupabaseEnabled,
  getOrCreateUser,
  syncToSupabase,
  loadFromSupabase,
} from '@/lib/supabase'
import { flushPersist } from '@/store/library'

/**
 * Cloud sync hook — Supabase with IndexedDB fallback.
 *
 * 1. On mount: authenticate device, load from Supabase if no local data
 * 2. On changes: debounced sync to Supabase + IndexedDB
 * 3. On unload: flush all pending saves
 */

const DEVICE_KEY_STORAGE = 'lumiere:device-key'
const USER_ID_STORAGE = 'lumiere:user-id'
const SYNC_DEBOUNCE = 5000

export function useNeonSync() {
  const userIdRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)
  const lastSyncHashRef = useRef('')

  // ── Beforeunload: flush pending saves ────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = useLibrary.getState()
      if (state.scannedFiles.length > 0) {
        void flushPersist()
      }
    }
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        await flushPersist()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Get or create device key
  const getDeviceKey = useCallback((): string => {
    if (typeof window === 'undefined') return ''
    let key = localStorage.getItem(DEVICE_KEY_STORAGE)
    if (!key) {
      key = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(DEVICE_KEY_STORAGE, key)
    }
    return key
  }, [])

  // Authenticate with Supabase
  const authenticate = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null
    const cached = localStorage.getItem(USER_ID_STORAGE)
    if (cached) {
      userIdRef.current = cached
      return cached
    }
    if (!isSupabaseEnabled) return null

    try {
      const deviceKey = getDeviceKey()
      const userId = await getOrCreateUser(deviceKey)
      if (userId) {
        localStorage.setItem(USER_ID_STORAGE, userId)
        userIdRef.current = userId
      }
      return userId
    } catch {
      return null
    }
  }, [getDeviceKey])

  // Sync to Supabase
  const syncToCloud = useCallback(async () => {
    if (isSyncingRef.current) return
    const userId = userIdRef.current
    if (!userId || !isSupabaseEnabled) return

    isSyncingRef.current = true
    try {
      const state = useLibrary.getState()
      if (state.scannedFiles.length === 0) return

      const hash = `${state.scannedFiles.length}:${Object.keys(state.enrichment).length}:${state.collections.length}`
      if (hash === lastSyncHashRef.current) return
      lastSyncHashRef.current = hash

      await syncToSupabase(userId, {
        folders: state.scannedFolders.map((f) => ({
          id: f.id,
          name: f.name,
          fileCount: f.fileCount,
          hasFsaHandle: f.hasFsaHandle,
        })),
        files: state.scannedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          path: f.path,
          kind: f.kind,
          size: f.size,
          folderId: f.folderId,
        })),
        rawMetadata: Object.fromEntries(
          Object.entries(state.rawMetadata).map(([id, md]) => {
            const { coverUrl, ...rest } = md
            void coverUrl
            return [id, rest]
          }),
        ),
        enrichment: state.enrichment,
        collections: state.collections.map((c) => ({
          id: c.id,
          title: c.title,
          movieIds: c.movieIds,
          coverUrl: c.coverUrl,
          year: c.year,
        })),
      })
    } catch (err) {
      console.warn('[sync] Cloud sync failed:', err)
    } finally {
      isSyncingRef.current = false
    }
  }, [])

  // Load from Supabase
  const loadFromCloud = useCallback(async (userId: string): Promise<boolean> => {
    if (!isSupabaseEnabled) return false
    try {
      const data = await loadFromSupabase(userId)
      if (!data || !data.folders || data.folders.length === 0) return false

      // Only apply if store is still empty
      if (useLibrary.getState().scannedFiles.length > 0) {
        console.log('[sync] Local data exists — skipping cloud load')
        return true
      }

      const { manifestToUnavailableFiles } = await import('@/lib/persist')
      const { categorizeFiles } = await import('@/lib/categorize')

      const files = manifestToUnavailableFiles(data.files as Array<{ id: string; name: string; path: string; kind: 'video' | 'audio'; size: number; folderId?: string }>)
      const rawMetadata = data.rawMetadata || {}
      const folders = (data.folders || []).map((f) => ({
        ...f,
        connected: false,
      }))

      const input = files.map((f) => ({
        file: f,
        metadata: rawMetadata[f.id] || {},
      }))
      const result = categorizeFiles(input)

      useLibrary.setState({
        scannedFiles: files,
        rawMetadata,
        scannedFolders: folders,
        enrichment: data.enrichment || {},
        currentView: 'home',
        movies: result.movies,
        collections: result.collections,
        tvShows: result.tvShows,
        albums: result.albums,
        podcasts: result.podcasts,
        stats: result.stats,
      })
      console.log('[sync] Library loaded from Supabase')
      return true
    } catch (err) {
      console.warn('[sync] Cloud load failed:', err)
      return false
    }
  }, [])

  // Initialize: authenticate, then try loading from cloud
  useEffect(() => {
    void (async () => {
      const userId = await authenticate()
      if (!userId) return

      // Wait for IndexedDB hydration to complete first
      await new Promise((r) => setTimeout(r, 2000))

      if (useLibrary.getState().scannedFiles.length === 0) {
        console.log('[sync] No local data — loading from Supabase...')
        await loadFromCloud(userId)
      }
    })()
  }, [authenticate, loadFromCloud])

  // Poll for changes and sync (every 5 seconds)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const state = useLibrary.getState()
      if (state.scannedFiles.length === 0) return
      const hash = `${state.scannedFiles.length}:${Object.keys(state.enrichment).length}:${state.collections.length}`
      if (hash !== lastSyncHashRef.current) {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => void syncToCloud(), SYNC_DEBOUNCE)
      }
    }, SYNC_DEBOUNCE)
    return () => clearInterval(checkInterval)
  }, [syncToCloud])

  // Periodic sync (every 30s) as safety net
  useEffect(() => {
    const interval = setInterval(() => void syncToCloud(), 30000)
    return () => clearInterval(interval)
  }, [syncToCloud])
}
