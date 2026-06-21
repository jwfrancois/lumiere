'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useLibrary } from '@/store/library'

/**
 * Neon database sync hook.
 *
 * Periodically syncs the in-memory library state to the Neon PostgreSQL
 * database via /api/library/sync. Also loads from Neon on first mount
 * if no local data exists.
 *
 * Auth: Uses a device key stored in localStorage. On first visit, a new
 * device key is generated and a User row is created in Neon.
 *
 * Fallback: If Neon is unreachable (e.g. offline or no DATABASE_URL),
 * silently falls back to IndexedDB persistence (the existing system).
 */

const DEVICE_KEY_STORAGE = 'lumiere:device-key'
const USER_ID_STORAGE = 'lumiere:user-id'
const SYNC_INTERVAL = 30000 // 30 seconds
const SYNC_DEBOUNCE = 3000 // 3 seconds after last change

export function useNeonSync() {
  const userIdRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)

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

  // Authenticate with the server
  const authenticate = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null
    // Check for cached user ID
    const cached = localStorage.getItem(USER_ID_STORAGE)
    if (cached) {
      userIdRef.current = cached
      return cached
    }

    try {
      const deviceKey = getDeviceKey()
      const res = await fetch('/api/auth/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey }),
      })
      if (!res.ok) return null
      const data = await res.json()
      localStorage.setItem(USER_ID_STORAGE, data.userId)
      userIdRef.current = data.userId
      return data.userId
    } catch {
      // Server unreachable — fall back to IndexedDB
      return null
    }
  }, [getDeviceKey])

  // Sync library to Neon
  const syncToNeon = useCallback(async () => {
    if (isSyncingRef.current) return
    const userId = userIdRef.current
    if (!userId) return

    isSyncingRef.current = true
    try {
      const state = useLibrary.getState()
      const body = {
        userId,
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
      }

      await fetch('/api/library/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.warn('[neon] Sync failed (will retry):', err)
    } finally {
      isSyncingRef.current = false
    }
  }, [])

  // Load from Neon
  const loadFromNeon = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/library/load?userId=${userId}`)
      if (!res.ok) return false
      const data = await res.json()
      if (!data.folders || data.folders.length === 0) return false

      // Import the persist helpers to apply the loaded data
      const { manifestToUnavailableFiles } = await import('@/lib/persist')
      const { categorizeFiles } = await import('@/lib/categorize')

      const files = manifestToUnavailableFiles(data.files)
      const rawMetadata = data.rawMetadata || {}
      const folders = (data.folders || []).map((f: { id: string; name: string; fileCount: number; scannedAt: number; hasFsaHandle: boolean }) => ({
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
        collections: data.collections || [],
        currentView: 'home',
        movies: result.movies,
        collections: result.collections,
        tvShows: result.tvShows,
        albums: result.albums,
        podcasts: result.podcasts,
        stats: result.stats,
      })

      return true
    } catch (err) {
      console.warn('[neon] Load failed:', err)
      return false
    }
  }, [])

  // Initialize: authenticate, then try loading from Neon
  useEffect(() => {
    void (async () => {
      const userId = await authenticate()
      if (!userId) return // Server unreachable — fall back to IndexedDB

      // If local store is empty, try loading from Neon
      const hasLocalData = useLibrary.getState().scannedFiles.length > 0
      if (!hasLocalData) {
        console.log('[neon] No local data — loading from Neon...')
        const loaded = await loadFromNeon(userId)
        if (loaded) {
          console.log('[neon] Library loaded from Neon')
        }
      }
    })()
  }, [authenticate, loadFromNeon])

  // Debounced sync — whenever the library changes, schedule a sync
  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      void syncToNeon()
    }, SYNC_DEBOUNCE)
  }, [syncToNeon])

  // Subscribe to store changes
  useEffect(() => {
    const unsub = useLibrary.subscribe(
      (state) => state.scannedFiles.length + state.enrichment.size,
      () => scheduleSync(),
    )
    return unsub
  }, [scheduleSync])

  // Periodic sync (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      void syncToNeon()
    }, SYNC_INTERVAL)
    return () => clearInterval(interval)
  }, [syncToNeon])
}
