/**
 * Global media library state.
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
}

export const useLibrary = create<LibraryState>((set, get) => ({
  isScanning: false,
  scanProgress: { scanned: 0, found: 0, currentPath: '' },
  scannedFiles: [],
  rawMetadata: {},
  scannedFolders: [],
  movies: [],
  collections: [],
  tvShows: [],
  albums: [],
  podcasts: [],
  enrichment: {},
  enriching: new Set<string>(),
  isEnriching: false,
  currentView: 'home',
  detailItem: null,
  queue: [],
  currentIndex: 0,
  isPlayerOpen: false,

  setScanning: (s) => set({ isScanning: s }),
  setScanProgress: (p) => set({ scanProgress: p }),
  setScanError: (e) => set({ scanError: e }),
  addFiles: (files, metadata, folderName) => {
    const existingFiles = get().scannedFiles
    const existingMeta = get().rawMetadata
    const allFiles = [...existingFiles, ...files]
    const allMeta = { ...existingMeta, ...metadata }
    const input = allFiles.map((f) => ({
      file: f,
      metadata: allMeta[f.id] || ({} as MediaMetadata),
    }))
    const result = categorizeFiles(input)
    const scannedFolders = [...get().scannedFolders]
    if (folderName && files.length > 0) {
      scannedFolders.push({
        id:
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-4),
        name: folderName,
        fileCount: files.length,
        scannedAt: Date.now(),
      })
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
  },
  reset: () =>
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
    }),
  setView: (v) => set({ currentView: v }),
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
  setEnrichment: (key, info) =>
    set((s) => ({
      enrichment: { ...s.enrichment, [key]: info },
    })),
  clearEnriching: (key) =>
    set((s) => {
      const next = new Set(s.enriching)
      next.delete(key)
      return { enriching: next }
    }),
  setIsEnriching: (s) => set({ isEnriching: s }),
}))

/** Convenience hook to build a movie-by-id map (re-derived on each render). */
export function useMoviesByIdMap(): Map<string, MovieItem> {
  const movies = useLibrary((s) => s.movies)
  const collections = useLibrary((s) => s.collections)
  const map = new Map<string, MovieItem>()
  for (const m of movies) map.set(m.id, m)
  // Note: collection movies are also in `movies` array (we keep them there
  // for the player to find), so we don't need to add them again here.
  void collections
  return map
}
