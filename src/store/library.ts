/**
 * Global media library state.
 *
 * Persistence: serializable data (folder list, file manifest, metadata,
 * enrichment) is auto-saved to localStorage. FileSystemDirectoryHandle
 * objects (for FSA scans) are saved to IndexedDB so folders can be
 * re-permissioned with one click after a page reload.
 */

import { create } from 'zustand'
import type { ScannedFile } from '../lib/media-scanner'
import { type MediaMetadata } from '../lib/metadata'
import {
  type CategorizationResult,
  type MovieItem,
  type AlbumItem,
  type TvShowItem,
  type PodcastItem,
  type CollectionItem,
  type PlayableItem,
  categorizeFiles,
} from '../lib/categorize'
import {
  saveLibrary,
  loadLibrary,
  clearLibrary,
  saveEnrichment,
  loadEnrichment,
  saveFsaHandle,
  deleteFsaHandle,
  getAllFsaHandles,
  walkFsaHandle,
  ensurePermission,
  stripCoverUrl,
  manifestToUnavailableFiles,
  isFsaSupported,
} from '../lib/persist'
import {
  loadHistory,
  saveHistory,
  recordPlay,
  type ListeningHistory,
  type TrackStats,
} from '../lib/listening-history'
import {
  loadTags,
  saveTags,
  addTag as addTagUtil,
  removeTag as removeTagUtil,
  getItemTags,
  getAllTags,
  type TagState,
} from '../lib/tags'

export type ViewName =
  | 'home'
  | 'movies'
  | 'collections'
  | 'tv'
  | 'music'
  | 'podcasts'

type DetailItem =
  | { kind: 'movie'; id: string }
  | { kind: 'collection'; id: string }
  | { kind: 'tv'; id: string }
  | { kind: 'album'; id: string }
  | { kind: 'podcast'; id: string }
  | null

export interface ScannedFolderInfo {
  /** Stable id derived from the folder name + timestamp. */
  id: string
  name: string
  fileCount: number
  scannedAt: number
  /** True when we have an FSA handle in IndexedDB for one-click reconnect. */
  hasFsaHandle?: boolean
  /** True when the folder's File objects are currently available for playback. */
  connected?: boolean
}

/** Enrichment data fetched from OMDB / iTunes / Wikipedia. */
export interface EnrichedInfo {
  // Movie/TV (OMDB)
  posterUrl?: string
  imdbRating?: number
  rottenTomatoes?: number
  metacritic?: number
  plot?: string
  genre?: string
  runtime?: string
  rated?: string
  director?: string
  cast?: string
  awards?: string
  totalSeasons?: number
  // Music (iTunes)
  artworkUrl?: string
  artworkUrlHiRes?: string
  copyright?: string
  itunesUrl?: string
  // Artist (Wikipedia + iTunes)
  photoUrl?: string
  bio?: string
  description?: string
}

interface LibraryState {
  // Scan state
  isScanning: boolean
  scanProgress: { scanned: number; found: number; currentPath: string }
  scanError?: string

  // Library data
  scannedFiles: ScannedFile[]
  rawMetadata: Record<string, MediaMetadata>
  /** Folders the user has scanned so far. */
  scannedFolders: ScannedFolderInfo[]
  movies: MovieItem[]
  collections: CollectionItem[]
  tvShows: TvShowItem[]
  albums: AlbumItem[]
  podcasts: PodcastItem[]
  stats?: CategorizationResult['stats']

  /**
   * Enrichment data keyed by a stable media-group key.
   * For movies: `movie:<id>`
   * For TV shows: `tv:<id>`
   * For collections: `collection:<id>`
   * (Albums and podcasts use embedded cover art only — no enrichment.)
   */
  enrichment: Record<string, EnrichedInfo>
  /** Items currently being enriched. */
  enriching: Set<string>
  /** Whether background enrichment is running. */
  isEnriching: boolean

  /** True while a reconnect operation is in progress. */
  isReconnecting: boolean

  // Current view
  currentView: ViewName

  // Detail drawer
  detailItem: DetailItem

  // Player queue
  queue: PlayableItem[]
  currentIndex: number
  isPlayerOpen: boolean

  // Actions
  setScanning: (s: boolean) => void
  setScanProgress: (p: { scanned: number; found: number; currentPath: string }) => void
  setScanError: (e?: string) => void
  addFiles: (
    files: ScannedFile[],
    metadata: Record<string, MediaMetadata>,
    folderName?: string,
    folderId?: string,
    fsaHandle?: FileSystemDirectoryHandle | null,
  ) => void
  reset: () => void
  setView: (v: ViewName) => void
  openDetail: (item: DetailItem) => void
  closeDetail: () => void
  playQueue: (items: PlayableItem[], startIndex?: number) => void
  playNext: (items: PlayableItem[]) => void
  next: () => void
  prev: () => void
  closePlayer: () => void
  // Enrichment actions
  markEnriching: (key: string) => void
  setEnrichment: (key: string, info: EnrichedInfo) => void
  clearEnriching: (key: string) => void
  setIsEnriching: (s: boolean) => void
  // Persistence + reconnect actions
  persist: () => void
  /** Load persisted library from localStorage. Must be called client-side only,
   * after hydration, to avoid SSR mismatches. */
  hydrateFromStorage: () => void
  reconnectAllFolders: () => Promise<void>
  reconnectFolder: (folderId: string) => Promise<boolean>
  /** Mark all files belonging to a folder as unavailable. */
  disconnectFolder: (folderId: string) => void
  // Manual collection management
  /** Create a new collection from a list of movie ids. Returns the new
   * collection id so callers can navigate to it. */
  createCollection: (title: string, movieIds: string[]) => string
  /** Add movies to an existing collection. */
  addToCollection: (collectionId: string, movieIds: string[]) => void
  /** Remove a movie from its collection. If the collection drops below 2
   * movies, it is automatically dissolved. */
  removeFromCollection: (collectionId: string, movieId: string) => void
  /** Rename a collection. */
  renameCollection: (collectionId: string, newTitle: string) => void
  /** Delete a collection entirely (movies go back to standalone). */
  deleteCollection: (collectionId: string) => void
  /** Re-derive categorization from scannedFiles + rawMetadata. Used after
   * manual collection edits so the derived state stays in sync. */
  rederive: () => void
  // Listening history (Roon-inspired)
  listeningHistory: ListeningHistory
  recordTrackPlay: (
    trackId: string,
    title: string,
    subtitle: string | undefined,
    durationSec?: number,
  ) => void
  getTrackStats: (trackId: string) => TrackStats | undefined
  // Tags (Roon-inspired)
  tagState: TagState
  addTag: (tagName: string, itemId: string) => void
  removeTag: (tagName: string, itemId: string) => void
  getItemTags: (itemId: string) => string[]
  getAllTags: () => string[]
}

/* ----------------------- persistence debounce ------------------------ */

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    useLibrary.getState().persist()
  }, 400)
}

/* ----------------------- hydration from disk ------------------------- *
 *
 * IMPORTANT: The store ALWAYS initializes with empty state so that SSR and
 * the first client render produce identical HTML (no hydration mismatch).
 * The persisted library is loaded in a useEffect via `hydrateFromStorage()`
 * after React has hydrated the tree.
 */

function applyPersistedData() {
  const persisted = loadLibrary()
  if (!persisted) return

  // Restore files in "unavailable" mode — UI shows posters + ratings,
  // playback is blocked until the user reconnects folders.
  const files = manifestToUnavailableFiles(persisted.fileManifest)
  // Restore metadata (coverUrls are gone — they were blob URLs)
  const rawMetadata: Record<string, MediaMetadata> = {}
  for (const [id, md] of Object.entries(persisted.rawMetadata)) {
    rawMetadata[id] = md as MediaMetadata
  }
  // Restore folders — all start disconnected
  const folders: ScannedFolderInfo[] = persisted.scannedFolders.map((f) => ({
    ...f,
    connected: false,
  }))
  // Re-derive categorization from the restored files + metadata
  const input = files.map((f) => ({
    file: f,
    metadata: rawMetadata[f.id] || ({} as MediaMetadata),
  }))
  const result = categorizeFiles(input)

  // Enrichment is NOT in persisted (it's in IndexedDB now).
  // It will be loaded async in hydrateFromStorage().
  useLibrary.setState({
    scannedFiles: files,
    rawMetadata,
    scannedFolders: folders,
    currentView: (persisted.currentView as ViewName) || 'home',
    movies: result.movies,
    collections: result.collections,
    tvShows: result.tvShows,
    albums: result.albums,
    podcasts: result.podcasts,
    stats: result.stats,
  })
}

export const useLibrary = create<LibraryState>((set, get) => ({
  isScanning: false,
  scanProgress: { scanned: 0, found: 0, currentPath: '' },
  // IMPORTANT: All library fields initialize EMPTY so SSR and the first
  // client render produce identical HTML. Persisted data is loaded via
  // `hydrateFromStorage()` in a useEffect after hydration.
  scannedFiles: [],
  rawMetadata: {},
  scannedFolders: [],
  movies: [],
  collections: [],
  tvShows: [],
  albums: [],
  podcasts: [],
  stats: undefined,
  enrichment: {},
  enriching: new Set<string>(),
  isEnriching: false,
  isReconnecting: false,
  // Listening history + tags start empty (matching SSR) and are loaded
  // in hydrateFromStorage() after mount to avoid hydration mismatch.
  listeningHistory: { tracks: {}, events: [] },
  tagState: { tags: {}, itemTags: {} },
  currentView: 'home',
  detailItem: null,
  queue: [],
  currentIndex: 0,
  isPlayerOpen: false,

  setScanning: (s) => set({ isScanning: s }),
  setScanProgress: (p) => set({ scanProgress: p }),
  setScanError: (e) => set({ scanError: e }),
  addFiles: (files, metadata, folderName, folderId, fsaHandle) => {
    const existingFiles = get().scannedFiles
    const existingMeta = get().rawMetadata
    // Tag incoming files with folderId if provided
    const taggedFiles = folderId
      ? files.map((f) => ({ ...f, folderId }))
      : files
    const allFiles = [...existingFiles, ...taggedFiles]
    const allMeta = { ...existingMeta, ...metadata }
    const input = allFiles.map((f) => ({
      file: f,
      metadata: allMeta[f.id] || ({} as MediaMetadata),
    }))
    const result = categorizeFiles(input)
    const scannedFolders = [...get().scannedFolders]
    let newFolderId = folderId
    if (folderName && files.length > 0) {
      if (folderId) {
        // Reconnect of an existing folder
        const idx = scannedFolders.findIndex((f) => f.id === folderId)
        if (idx >= 0) {
          scannedFolders[idx] = {
            ...scannedFolders[idx],
            fileCount: files.length,
            connected: true,
            hasFsaHandle: !!fsaHandle || scannedFolders[idx].hasFsaHandle,
          }
        }
      } else {
        // Brand-new folder
        newFolderId =
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-4)
        scannedFolders.push({
          id: newFolderId,
          name: folderName,
          fileCount: files.length,
          scannedAt: Date.now(),
          connected: true,
          hasFsaHandle: !!fsaHandle,
        })
        // Tag the files we just added with the new folder id
        for (let i = existingFiles.length; i < allFiles.length; i++) {
          allFiles[i].folderId = newFolderId
        }
        // If we have an FSA handle, persist it to IndexedDB keyed by folder id.
        if (fsaHandle) {
          void saveFsaHandle(newFolderId, fsaHandle)
        }
      }
    }
    set({
      scannedFiles: allFiles,
      rawMetadata: allMeta,
      scannedFolders,
      movies: result.movies,
      collections: result.collections,
      tvShows: result.tvShows,
      albums: result.albums,
      podcasts: result.podcasts,
      stats: result.stats,
    })
    schedulePersist()
  },
  reset: () => {
    clearLibrary()
    // Also clear all FSA handles from IndexedDB
    if (typeof indexedDB !== 'undefined') {
      get()
        .scannedFolders.filter((f) => f.hasFsaHandle)
        .forEach((f) => void deleteFsaHandle(f.id))
    }
    set({
      scannedFiles: [],
      rawMetadata: {},
      scannedFolders: [],
      movies: [],
      collections: [],
      tvShows: [],
      albums: [],
      podcasts: [],
      stats: undefined,
      detailItem: null,
      queue: [],
      isPlayerOpen: false,
      enrichment: {},
      enriching: new Set<string>(),
      isEnriching: false,
    })
  },
  setView: (v) => {
    set({ currentView: v })
    schedulePersist()
  },
  openDetail: (item) => set({ detailItem: item }),
  closeDetail: () => set({ detailItem: null }),
  playQueue: (items, startIndex = 0) => {
    if (items.length === 0) return
    set({ queue: items, currentIndex: startIndex, isPlayerOpen: true })
  },
  playNext: (items) => {
    const current = get().queue
    const newQueue = [
      ...current.slice(0, get().currentIndex + 1),
      ...items,
      ...current.slice(get().currentIndex + 1),
    ]
    set({ queue: newQueue })
  },
  next: () => {
    const { currentIndex, queue } = get()
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1 })
    }
  },
  prev: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 })
    }
  },
  closePlayer: () => set({ isPlayerOpen: false }),
  markEnriching: (key) =>
    set((s) => {
      const next = new Set(s.enriching)
      next.add(key)
      return { enriching: next }
    }),
  setEnrichment: (key, info) => {
    set((s) => ({
      enrichment: { ...s.enrichment, [key]: info },
    }))
    schedulePersist()
  },
  clearEnriching: (key) =>
    set((s) => {
      const next = new Set(s.enriching)
      next.delete(key)
      return { enriching: next }
    }),
  setIsEnriching: (s) => set({ isEnriching: s }),

  /* ----------------------- persistence + reconnect ----------------------- */

  hydrateFromStorage: () => {
    // Only run on client — loadLibrary() returns null on server.
    applyPersistedData()
    // Load listening history + tags from localStorage.
    set({
      listeningHistory: loadHistory(),
      tagState: loadTags(),
    })
    // Load enrichment from IndexedDB (async — the UI will update when
    // it resolves; enrichment data appears progressively after reload).
    void loadEnrichment().then((enrich) => {
      if (enrich && Object.keys(enrich).length > 0) {
        set({ enrichment })
      }
    })
  },

  persist: () => {
    const s = get()
    // Save lightweight library data to localStorage (no enrichment — too large)
    saveLibrary({
      scannedFolders: s.scannedFolders.map((f) => ({
        id: f.id,
        name: f.name,
        fileCount: f.fileCount,
        scannedAt: f.scannedAt,
        hasFsaHandle: f.hasFsaHandle,
      })),
      fileManifest: s.scannedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        kind: f.kind,
        size: f.size,
        folderId: f.folderId,
      })),
      rawMetadata: stripCoverUrl(s.rawMetadata),
      currentView: s.currentView,
      version: 2,
    })
    // Save enrichment to IndexedDB (50MB+ quota, handles large data)
    void saveEnrichment(s.enrichment)
  },

  reconnectAllFolders: async () => {
    if (!isFsaSupported()) return
    const folders = get().scannedFolders.filter((f) => f.hasFsaHandle)
    if (folders.length === 0) return
    set({ isReconnecting: true })
    try {
      const handles = await getAllFsaHandles()
      for (const folder of folders) {
        const handle = handles[folder.id]
        if (!handle) continue
        const ok = await ensurePermission(handle)
        if (!ok) continue
        // reconnectFolder is fully guarded — never throws.
        await get().reconnectFolder(folder.id)
      }
    } catch (err) {
      // Should never happen (all sub-calls are guarded), but just in case.
      console.error('reconnectAllFolders: unexpected error', err)
    } finally {
      set({ isReconnecting: false })
    }
  },

  reconnectFolder: async (folderId) => {
    const folder = get().scannedFolders.find((f) => f.id === folderId)
    if (!folder) return false
    set({ isReconnecting: true })
    try {
      const handles = await getAllFsaHandles()
      const handle = handles[folderId]
      if (!handle) {
        set({ isReconnecting: false })
        return false
      }
      const ok = await ensurePermission(handle)
      if (!ok) {
        set({ isReconnecting: false })
        return false
      }
      // Re-walk the handle and rebuild File + url for every media file.
      // walkFsaHandle is fully guarded against NotFoundError — files/folders
      // that have been moved or deleted since the scan are simply skipped.
      const walked = await walkFsaHandle(handle)
      if (walked.length === 0) {
        // Folder is empty or completely unreadable (e.g. moved). Mark
        // the folder as still-disconnected and bail out.
        console.warn(
          'reconnectFolder: no readable files in',
          folder.name,
          '— folder may have been moved or deleted',
        )
        set({ isReconnecting: false })
        return false
      }
      // Match walked files against the persisted manifest by relative path.
      const filesByPath = new Map(walked.map((w) => [w.path, w.file]))
      const scannedFiles = [...get().scannedFiles]
      let reconnectedCount = 0
      let missingCount = 0
      for (let i = 0; i < scannedFiles.length; i++) {
        const f = scannedFiles[i]
        if (f.folderId !== folderId) continue
        const realFile = filesByPath.get(f.path)
        if (realFile) {
          scannedFiles[i] = {
            ...f,
            file: realFile,
            url: URL.createObjectURL(realFile),
            unavailable: false,
          }
          reconnectedCount++
        } else {
          // File was in the manifest but no longer exists on disk.
          // Leave it as unavailable so the UI can show it as missing.
          scannedFiles[i] = { ...f, unavailable: true }
          missingCount++
        }
      }
      const scannedFolders = get().scannedFolders.map((sf) =>
        sf.id === folderId ? { ...sf, connected: true } : sf,
      )
      set({ scannedFiles, scannedFolders })
      schedulePersist()
      if (missingCount > 0) {
        console.info(
          `reconnectFolder: ${reconnectedCount} files reconnected, ${missingCount} missing from "${folder.name}"`,
        )
      }
      return true
    } catch (err) {
      // Catch-all for any unexpected errors (e.g. handle invalidated,
      // IndexedDB corruption, etc.) — never let reconnect throw to the UI.
      console.error('reconnectFolder: unexpected error for', folder.name, err)
      set({ isReconnecting: false })
      return false
    } finally {
      set({ isReconnecting: false })
    }
  },

  disconnectFolder: (folderId) => {
    const scannedFiles = get().scannedFiles.map((f) =>
      f.folderId === folderId
        ? { ...f, unavailable: true, url: '', file: new File([], f.name) }
        : f,
    )
    const scannedFolders = get().scannedFolders.map((sf) =>
      sf.id === folderId ? { ...sf, connected: false } : sf,
    )
    set({ scannedFiles, scannedFolders })
    schedulePersist()
  },

  /* --------------------- manual collection management --------------------- */

  rederive: () => {
    // Re-run categorization from the current scannedFiles + rawMetadata.
    // Used after manual collection edits so movies/collections arrays stay
    // in sync with any collectionId changes we made directly.
    const allFiles = get().scannedFiles
    const allMeta = get().rawMetadata
    const input = allFiles.map((f) => ({
      file: f,
      metadata: allMeta[f.id] || ({} as MediaMetadata),
    }))
    const result = categorizeFiles(input)
    // Preserve any manually-set collectionId / collectionOrder on movies
    // by re-applying them after categorization re-derives its own.
    // (categorizeFiles resets collectionId based on its detection logic, so
    // we need to override with our manual state stored in a side map.)
    const manualCollections = get().collections
    const manualCollectionIds = new Map<string, string>() // movieId -> collectionId
    for (const c of manualCollections) {
      for (const mid of c.movieIds) {
        manualCollectionIds.set(mid, c.id)
      }
    }
    // Override the auto-derived collection membership with manual state
    const finalMovies = result.movies.map((m) => {
      const manualCid = manualCollectionIds.get(m.id)
      if (manualCid) {
        const coll = manualCollections.find((c) => c.id === manualCid)
        if (coll) {
          const order = coll.movieIds.indexOf(m.id) + 1
          return { ...m, collectionId: manualCid, collectionOrder: order }
        }
      }
      // If auto-detected a collection but we don't have it manually, clear it
      // (unless it's also in our manual list — which we just handled)
      if (m.collectionId && !manualCollections.some((c) => c.id === m.collectionId)) {
        return { ...m, collectionId: undefined, collectionOrder: undefined }
      }
      return m
    })
    set({
      movies: finalMovies,
      collections: manualCollections,
      tvShows: result.tvShows,
      albums: result.albums,
      podcasts: result.podcasts,
      stats: {
        ...result.stats,
        standaloneMovies: finalMovies.filter((m) => !m.collectionId).length,
        collectionMovies: finalMovies.filter((m) => m.collectionId).length,
        collections: manualCollections.length,
      },
    })
    schedulePersist()
  },

  createCollection: (title, movieIds) => {
    const id =
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36).slice(-4)
    const newCollection: CollectionItem = {
      id,
      title,
      category: 'movie',
      isCollection: true,
      movieIds: [...movieIds],
      coverUrl: undefined,
      year: undefined,
    }
    // Try to grab cover/year from first movie
    const firstMovie = get().movies.find((m) => m.id === movieIds[0])
    if (firstMovie) {
      newCollection.coverUrl = firstMovie.coverUrl
      newCollection.year = firstMovie.year
    }
    set((s) => ({
      collections: [...s.collections, newCollection],
    }))
    // Re-derive so movie.collectionId gets set
    get().rederive()
    return id
  },

  addToCollection: (collectionId, movieIds) => {
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              movieIds: [
                ...c.movieIds,
                ...movieIds.filter((id) => !c.movieIds.includes(id)),
              ],
            }
          : c,
      ),
    }))
    get().rederive()
  },

  removeFromCollection: (collectionId, movieId) => {
    const coll = get().collections.find((c) => c.id === collectionId)
    if (!coll) return
    const newMovieIds = coll.movieIds.filter((id) => id !== movieId)
    if (newMovieIds.length < 2) {
      // Auto-dissolve: too few movies to be a collection
      get().deleteCollection(collectionId)
      return
    }
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, movieIds: newMovieIds } : c,
      ),
    }))
    get().rederive()
  },

  renameCollection: (collectionId, newTitle) => {
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, title: newTitle } : c,
      ),
    }))
    schedulePersist()
  },

  deleteCollection: (collectionId) => {
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== collectionId),
    }))
    get().rederive()
  },

  /* --------------------- listening history + tags --------------------- */

  recordTrackPlay: (trackId, title, subtitle, durationSec) => {
    const updated = recordPlay(
      get().listeningHistory,
      trackId,
      title,
      subtitle,
      durationSec,
    )
    set({ listeningHistory: updated })
    saveHistory(updated)
  },

  getTrackStats: (trackId) => get().listeningHistory.tracks[trackId],

  addTag: (tagName, itemId) => {
    const updated = addTagUtil(get().tagState, tagName, itemId)
    set({ tagState: updated })
    saveTags(updated)
  },

  removeTag: (tagName, itemId) => {
    const updated = removeTagUtil(get().tagState, tagName, itemId)
    set({ tagState: updated })
    saveTags(updated)
  },

  getItemTags: (itemId) => getItemTags(get().tagState, itemId),

  getAllTags: () => getAllTags(get().tagState),
}))

/** Convenience hook to build a movie-by-id map (re-derived on each render). */
export function useMoviesByIdMap(): Map<string, MovieItem> {
  const movies = useLibrary((s) => s.movies)
  const map = new Map<string, MovieItem>()
  for (const m of movies) map.set(m.id, m)
  return map
}

/** True if any folder is currently disconnected (files unavailable). */
export function hasDisconnectedFolders(): boolean {
  const s = useLibrary.getState()
  return s.scannedFolders.some((f) => !f.connected)
}
