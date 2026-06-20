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
  saveFsaHandle,
  deleteFsaHandle,
  getAllFsaHandles,
  walkFsaHandle,
  ensurePermission,
  stripCoverUrl,
  manifestToUnavailableFiles,
  isFsaSupported,
} from '../lib/persist'

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

/** Enrichment data fetched from OMDB. */
export interface EnrichedInfo {
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
  reconnectAllFolders: () => Promise<void>
  reconnectFolder: (folderId: string) => Promise<boolean>
  /** Mark all files belonging to a folder as unavailable. */
  disconnectFolder: (folderId: string) => void
}

/* ----------------------- persistence debounce ------------------------ */

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    useLibrary.getState().persist()
  }, 400)
}

/* ----------------------- initial state from disk --------------------- */

function loadInitialState() {
  const persisted = loadLibrary()
  if (!persisted) {
    return {
      scannedFiles: [] as ScannedFile[],
      rawMetadata: {} as Record<string, MediaMetadata>,
      scannedFolders: [] as ScannedFolderInfo[],
      enrichment: {} as Record<string, EnrichedInfo>,
      currentView: 'home' as ViewName,
      movies: [] as MovieItem[],
      collections: [] as CollectionItem[],
      tvShows: [] as TvShowItem[],
      albums: [] as AlbumItem[],
      podcasts: [] as PodcastItem[],
      stats: undefined as CategorizationResult['stats'] | undefined,
    }
  }
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
  return {
    scannedFiles: files,
    rawMetadata,
    scannedFolders: folders,
    enrichment: persisted.enrichment,
    currentView: (persisted.currentView as ViewName) || 'home',
    movies: result.movies,
    collections: result.collections,
    tvShows: result.tvShows,
    albums: result.albums,
    podcasts: result.podcasts,
    stats: result.stats,
  }
}

const initial = loadInitialState()

export const useLibrary = create<LibraryState>((set, get) => ({
  isScanning: false,
  scanProgress: { scanned: 0, found: 0, currentPath: '' },
  scannedFiles: initial.scannedFiles,
  rawMetadata: initial.rawMetadata,
  scannedFolders: initial.scannedFolders,
  movies: initial.movies,
  collections: initial.collections,
  tvShows: initial.tvShows,
  albums: initial.albums,
  podcasts: initial.podcasts,
  stats: initial.stats,
  enrichment: initial.enrichment,
  enriching: new Set<string>(),
  isEnriching: false,
  isReconnecting: false,
  currentView: initial.currentView,
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

  persist: () => {
    const s = get()
    saveLibrary({
      scannedFolders: s.scannedFolders.map((f) => ({
        id: f.id,
        name: f.name,
        fileCount: f.fileCount,
        scannedAt: f.scannedAt,
        hasFsaHandle: f.hasFsaHandle,
        // Don't persist `connected` — always starts as false on reload
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
      enrichment: s.enrichment,
      currentView: s.currentView,
      version: 1,
    })
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
        await get().reconnectFolder(folder.id)
      }
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
      // Re-walk the handle and rebuild File + url for every media file
      const walked = await walkFsaHandle(handle)
      // Match walked files against the persisted manifest by relative path.
      const filesByPath = new Map(walked.map((w) => [w.path, w.file]))
      const scannedFiles = [...get().scannedFiles]
      let reconnectedCount = 0
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
        }
      }
      const scannedFolders = get().scannedFolders.map((sf) =>
        sf.id === folderId ? { ...sf, connected: true } : sf,
      )
      set({ scannedFiles, scannedFolders })
      schedulePersist()
      void reconnectedCount
      return true
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

/** True when there's persisted data from a previous session. */
export const hasRestoredData = initial.scannedFolders.length > 0
