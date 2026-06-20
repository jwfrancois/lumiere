/**
 * Categorize scanned files into Movies, Movie Collections (sequels),
 * TV Shows (series of episodes), Music Albums (tracks), and Podcasts (episodes).
 *
 * Strategy:
 *  - Use embedded metadata first (showName, seasonNumber, episodeNumber,
 *    album, albumArtist) when present.
 *  - Fall back to filename heuristics — strip episode/track markers, detect
 *    sequel suffixes, etc.
 */

import type { MediaMetadata } from './metadata'
import type { ScannedFile } from './media-scanner'

export type MediaCategory =
  | 'movie'
  | 'tv'
  | 'album'
  | 'podcast'
  | 'uncategorized'

export interface BaseItem {
  id: string
  title: string
  category: MediaCategory
  coverUrl?: string
  description?: string
  year?: number
  genre?: string
  artist?: string
}

export interface MovieItem extends BaseItem {
  category: 'movie'
  file: ScannedFile
  metadata: MediaMetadata
  collectionId?: string
  collectionOrder?: number
}

export interface CollectionItem extends BaseItem {
  category: 'movie'
  isCollection: true
  movieIds: string[]
}

export interface TvEpisode {
  id: string
  file: ScannedFile
  metadata: MediaMetadata
  seasonNumber: number
  episodeNumber: number
}

export interface TvShowItem extends BaseItem {
  category: 'tv'
  seasons: Record<number, TvEpisode[]>
  totalEpisodes: number
}

export interface AlbumTrack {
  id: string
  file: ScannedFile
  metadata: MediaMetadata
  trackNumber: number
}

export interface AlbumItem extends BaseItem {
  category: 'album'
  artist: string
  tracks: AlbumTrack[]
  totalTracks: number
}

export interface PodcastEpisode {
  id: string
  file: ScannedFile
  metadata: MediaMetadata
  episodeNumber: number
  publishedAt?: string
}

export interface PodcastItem extends BaseItem {
  category: 'podcast'
  host?: string
  episodes: PodcastEpisode[]
  totalEpisodes: number
}

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'in',
  'on',
  'at',
  'to',
  'for',
])

/** Normalize a title for grouping/comparison. */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ') // strip parentheticals
    .replace(/[._\-]+/g, ' ')
    .replace(/\b(1080p|720p|480p|2160p|4k|uhd|hdr|hdr10|dolby|atmos|bluray|blu-ray|web-dl|webrip|web dl|x264|x265|h264|h265|hevc|aac|ac3|dts|5\.1|7\.1|yify|rarbg|ntb|eztv|ettv|mkvcage|amzn|nf|dl|ddp|dd|repack|proper|extended|unrated|remastered|imax|directors|cut)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip the episode/track marker from a filename, returning the base title. */
export function stripEpisodeMarker(name: string): string {
  return (
    name
      // s01e12 / 1x12 / S1E12
      .replace(/\s*[-_ ]?\s*[sS]\d{1,2}\s*[eE]\d{1,3}.*$/, '')
      .replace(/\s*[-_ ]?\s*\d{1,2}[xX]\d{1,3}.*$/, '')
      // "Episode 12" or "Ep 12"
      .replace(/\s*[-_ ]?\s*ep(isode)?\s*\d+.*$/i, '')
      // "Track 12" or "12." prefix
      .replace(/^\s*\d{1,3}\s*[-_. ]\s*/, '')
      // trailing pure number (e.g. "Movie Name 2")
      .replace(/\s*[-_ ]?\s*[sS]?\d{1,2}[eE]?\d{0,3}$/, (m) =>
        /^ \d{1,2}$/.test(m) ? m : '',
      )
      .replace(/[._]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Try to parse season/episode info from a filename. */
export function parseEpisodeInfo(
  name: string,
): { season: number; episode: number } | null {
  const s1e1 = name.match(/[sS](\d{1,2})\s*[eE](\d{1,3})/)
  if (s1e1) {
    return {
      season: parseInt(s1e1[1], 10),
      episode: parseInt(s1e1[2], 10),
    }
  }
  const xFormat = name.match(/(\d{1,2})[xX](\d{1,3})/)
  if (xFormat) {
    return {
      season: parseInt(xFormat[1], 10),
      episode: parseInt(xFormat[2], 10),
    }
  }
  const epWord = name.match(/ep(?:isode)?\s*(\d{1,3})/i)
  if (epWord) {
    return { season: 1, episode: parseInt(epWord[1], 10) }
  }
  return null
}

/** Try to parse a track number prefix, e.g. "01 - Track Name" or "01. Name". */
export function parseTrackNumber(name: string): number | null {
  const m = name.match(/^\s*0*(\d{1,3})\s*[-_. ]\s+/)
  if (m) return parseInt(m[1], 10)
  return null
}

/** Try to parse a sequel number, e.g. "Movie 2", "Movie II", "Movie Part 2". */
export function parseSequelNumber(title: string): number | null {
  // Trailing digit
  const m1 = title.match(/\s(\d{1,2})$/)
  if (m1) return parseInt(m1[1], 10)
  // Roman numerals (I, II, III, IV, V...)
  const m2 = title.match(/\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3})$/i)
  if (m2) {
    const roman = m2[1].toUpperCase()
    const map: Record<string, number> = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      V: 5,
      VI: 6,
      VII: 7,
      VIII: 8,
      IX: 9,
      X: 10,
      XI: 11,
      XII: 12,
    }
    if (map[roman]) return map[roman]
  }
  // "Part 2" / "Part II"
  const m3 = title.match(/\bpart\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|\d{1,2})$/i)
  if (m3) {
    return parseSequelNumber(m3[1]) || parseInt(m3[1], 10)
  }
  return null
}

/** Strip the sequel number from a title. */
export function stripSequelNumber(title: string): string {
  return title
    .replace(/\s+\d{1,2}$/, '')
    .replace(/\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3})$/, '')
    .replace(/\s+part\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|\d{1,2})$/i, '')
    .trim()
}

/** Compute the shared prefix of an array of strings (word-level). */
function sharedPrefix(titles: string[]): string {
  if (titles.length === 0) return ''
  if (titles.length === 1) return titles[0]
  const split = titles.map((t) => t.split(/\s+/))
  let i = 0
  outer: while (i < split[0].length) {
    const w = split[0][i]
    for (let j = 1; j < split.length; j++) {
      if (i >= split[j].length || split[j][i] !== w) break outer
    }
    i++
  }
  return split[0].slice(0, i).join(' ').trim()
}

/**
 * Main categorization function. Walks each scanned file, extracts metadata,
 * and assigns it to the right library bucket.
 */
export interface CategorizationResult {
  /** All movies — including ones grouped into collections. */
  movies: MovieItem[]
  collections: CollectionItem[]
  tvShows: TvShowItem[]
  albums: AlbumItem[]
  podcasts: PodcastItem[]
  uncategorized: ScannedFile[]
  /** Tracks total scan stats. */
  stats: {
    total: number
    movies: number
    standaloneMovies: number
    collectionMovies: number
    collections: number
    tvShows: number
    albums: number
    podcasts: number
  }
}

export interface CategorizedFile {
  file: ScannedFile
  metadata: MediaMetadata
}

/**
 * Heuristic to decide whether an audio file is a podcast vs a music track.
 * Podcasts often have "podcast", "episode", "ep", or a long-form duration.
 */
function looksLikePodcast(meta: MediaMetadata, fileName: string): boolean {
  if (meta.genre && /podcast|talk|spoken|audiobook/i.test(meta.genre)) return true
  const fn = fileName.toLowerCase()
  if (/podcast|episode|^ep\d|[\s._]ep\d/.test(fn)) return true
  // Episodes longer than 25 minutes that are not clearly music
  if (meta.durationSec && meta.durationSec > 25 * 60) {
    if (!meta.album && !meta.albumArtist) return true
  }
  return false
}

export function categorizeFiles(
  files: { file: ScannedFile; metadata: MediaMetadata }[],
): CategorizationResult {
  const movies: MovieItem[] = []
  const tvShows = new Map<string, TvShowItem>()
  const albums = new Map<string, AlbumItem>()
  const podcasts = new Map<string, PodcastItem>()

  for (const { file, metadata } of files) {
    if (file.kind === 'video') {
      // Determine if it's a TV episode or a movie
      const epInfo =
        metadata.seasonNumber && metadata.episodeNumber
          ? {
              season: metadata.seasonNumber,
              episode: metadata.episodeNumber,
            }
          : parseEpisodeInfo(file.name)

      if (metadata.showName || epInfo) {
        const showName =
          metadata.showName ||
          stripEpisodeMarker(file.name.replace(/\.[^.]+$/, '')) ||
          'Unknown Show'
        const key = normalizeTitle(showName)
        let show = tvShows.get(key)
        if (!show) {
          show = {
            id: uid(),
            title: titleCase(showName),
            category: 'tv',
            coverUrl: metadata.coverUrl,
            description: metadata.description,
            year: metadata.year,
            genre: metadata.genre,
            seasons: {},
            totalEpisodes: 0,
          }
          tvShows.set(key, show)
        }
        const season = epInfo?.season ?? metadata.seasonNumber ?? 1
        const episode = epInfo?.episode ?? metadata.episodeNumber ?? 1
        if (!show.seasons[season]) show.seasons[season] = []
        show.seasons[season].push({
          id: uid(),
          file,
          metadata,
          seasonNumber: season,
          episodeNumber: episode,
        })
        show.totalEpisodes++
        if (!show.coverUrl && metadata.coverUrl) show.coverUrl = metadata.coverUrl
      } else {
        movies.push({
          id: uid(),
          title: metadata.title || file.name,
          category: 'movie',
          coverUrl: metadata.coverUrl,
          description: metadata.description,
          year: metadata.year,
          genre: metadata.genre,
          artist: metadata.artist,
          file,
          metadata,
        })
      }
    } else {
      // audio file
      if (looksLikePodcast(metadata, file.name)) {
        const showName =
          metadata.showName ||
          metadata.album ||
          stripEpisodeMarker(file.name.replace(/\.[^.]+$/, '')) ||
          'Unknown Podcast'
        const key = normalizeTitle(showName)
        let pod = podcasts.get(key)
        if (!pod) {
          pod = {
            id: uid(),
            title: titleCase(showName),
            category: 'podcast',
            coverUrl: metadata.coverUrl,
            description: metadata.description,
            host: metadata.artist || metadata.albumArtist,
            year: metadata.year,
            episodes: [],
            totalEpisodes: 0,
          }
          podcasts.set(key, pod)
        }
        const epNum = metadata.episodeNumber || parseTrackNumber(file.name) || pod.episodes.length + 1
        pod.episodes.push({
          id: uid(),
          file,
          metadata,
          episodeNumber: epNum,
          publishedAt: metadata.year ? String(metadata.year) : undefined,
        })
        pod.totalEpisodes++
        if (!pod.coverUrl && metadata.coverUrl) pod.coverUrl = metadata.coverUrl
      } else {
        const albumName = metadata.album || 'Unknown Album'
        const albumArtist =
          metadata.albumArtist ||
          metadata.artist ||
          metadata.composer ||
          'Unknown Artist'
        const key = normalizeTitle(albumName + '|' + albumArtist)
        let album = albums.get(key)
        if (!album) {
          album = {
            id: uid(),
            title: albumName,
            category: 'album',
            artist: albumArtist,
            coverUrl: metadata.coverUrl,
            description: metadata.description,
            year: metadata.year,
            genre: metadata.genre,
            tracks: [],
            totalTracks: 0,
          }
          albums.set(key, album)
        }
        const trackNum =
          metadata.trackNumber || parseTrackNumber(file.name) || album.tracks.length + 1
        album.tracks.push({
          id: uid(),
          file,
          metadata,
          trackNumber: trackNum,
        })
        album.totalTracks++
        if (!album.coverUrl && metadata.coverUrl) album.coverUrl = metadata.coverUrl
        if (!album.year && metadata.year) album.year = metadata.year
      }
    }
  }

  // Sort episodes and tracks
  for (const show of tvShows.values()) {
    for (const season of Object.keys(show.seasons)) {
      show.seasons[Number(season)].sort((a, b) => a.episodeNumber - b.episodeNumber)
    }
  }
  for (const album of albums.values()) {
    album.tracks.sort((a, b) => a.trackNumber - b.trackNumber)
  }
  for (const pod of podcasts.values()) {
    pod.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)
  }

  // Detect movie collections — group movies that share a common word prefix
  // of at least 2 words AND have a sequel-style marker (numeric or roman).
  // Examples that should group:
  //   "Lord of the Rings - Fellowship of the Ring 1"
  //   "Lord of the Rings - The Two Towers 2"
  //   "Lord of the Rings - Return of the King 3"
  // We use word-level shared-prefix clustering.
  type MovieWithKey = {
    movie: MovieItem
    sequel: number
    words: string[]
  }
  const withKeys: MovieWithKey[] = []
  for (const movie of movies) {
    const normalized = normalizeTitle(movie.title)
    const sequel = parseSequelNumber(normalized)
    if (sequel === null) continue
    const stripped = stripSequelNumber(normalized)
    const words = stripped.split(/\s+/).filter(Boolean)
    if (words.length < 2) continue
    withKeys.push({ movie, sequel, words })
  }

  // Cluster movies that share the first N words (greedy: try N=5 down to 2).
  const collectionMap = new Map<string, MovieWithKey[]>()
  const used = new Set<string>()
  for (let prefixLen = 5; prefixLen >= 2; prefixLen--) {
    for (const item of withKeys) {
      if (used.has(item.movie.id)) continue
      if (item.words.length < prefixLen) continue
      const key = item.words.slice(0, prefixLen).join(' ')
      // Find others not yet used that share this prefix
      const group = withKeys.filter(
        (o) =>
          !used.has(o.movie.id) &&
          o.words.length >= prefixLen &&
          o.words.slice(0, prefixLen).join(' ') === key,
      )
      if (group.length >= 2) {
        collectionMap.set(key, group)
        for (const g of group) used.add(g.movie.id)
      }
    }
  }

  const collections: CollectionItem[] = []
  for (const [base, group] of collectionMap.entries()) {
    group.sort((a, b) => a.sequel - b.sequel)
    const collectionId = uid()
    for (let i = 0; i < group.length; i++) {
      group[i].movie.collectionId = collectionId
      group[i].movie.collectionOrder = i + 1
    }
    // Use the longest shared prefix as the collection title
    const titles = group.map((g) => normalizeTitle(g.movie.title))
    const shared = sharedPrefix(titles)
    collections.push({
      id: collectionId,
      title: titleCase(shared || base),
      category: 'movie',
      isCollection: true,
      movieIds: group.map((g) => g.movie.id),
      coverUrl: group[0].movie.coverUrl,
      year: group[0].movie.year,
    })
  }

  // All movies (standalone + collection members) are kept in `movies`.
  // Collection membership is marked by `collectionId` on each MovieItem.

  return {
    movies,
    collections,
    tvShows: Array.from(tvShows.values()),
    albums: Array.from(albums.values()),
    podcasts: Array.from(podcasts.values()),
    uncategorized: [],
    stats: {
      total: files.length,
      movies: movies.length,
      standaloneMovies: movies.filter((m) => !m.collectionId).length,
      collectionMovies: movies.filter((m) => m.collectionId).length,
      collections: collections.length,
      tvShows: tvShows.size,
      albums: albums.size,
      podcasts: podcasts.size,
    },
  }
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (STOP_WORDS.has(w.toLowerCase()) && w !== s.split(/\s+/)[0]) {
        return w.toLowerCase()
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Build a flat list of "playable items" for the player queue.
 * Used when starting playback from an album / show / collection.
 */
export interface PlayableItem {
  id: string
  title: string
  subtitle?: string
  file: ScannedFile
  metadata: MediaMetadata
  kind: 'video' | 'audio'
}

export function buildAlbumQueue(album: AlbumItem): PlayableItem[] {
  return album.tracks.map((t) => ({
    id: t.id,
    title: t.metadata.title || `Track ${t.trackNumber}`,
    subtitle: album.artist,
    file: t.file,
    metadata: t.metadata,
    kind: 'audio',
  }))
}

export function buildShowQueue(
  show: TvShowItem,
  startEpisodeId?: string,
): PlayableItem[] {
  const items: PlayableItem[] = []
  const seasons = Object.keys(show.seasons)
    .map(Number)
    .sort((a, b) => a - b)
  for (const s of seasons) {
    for (const ep of show.seasons[s]) {
      items.push({
        id: ep.id,
        title: `S${s.toString().padStart(2, '0')}E${ep.episodeNumber
          .toString()
          .padStart(2, '0')} — ${ep.metadata.title || ''}`,
        subtitle: show.title,
        file: ep.file,
        metadata: ep.metadata,
        kind: 'video',
      })
    }
  }
  if (startEpisodeId) {
    const idx = items.findIndex((i) => i.id === startEpisodeId)
    if (idx > 0) return [...items.slice(idx), ...items.slice(0, idx)]
  }
  return items
}

export function buildPodcastQueue(
  podcast: PodcastItem,
  startEpisodeId?: string,
): PlayableItem[] {
  const items: PlayableItem[] = podcast.episodes.map((ep) => ({
    id: ep.id,
    title: ep.metadata.title || `Episode ${ep.episodeNumber}`,
    subtitle: podcast.title,
    file: ep.file,
    metadata: ep.metadata,
    kind: 'audio',
  }))
  if (startEpisodeId) {
    const idx = items.findIndex((i) => i.id === startEpisodeId)
    if (idx > 0) return [...items.slice(idx), ...items.slice(0, idx)]
  }
  return items
}

export function buildCollectionQueue(
  collection: CollectionItem,
  moviesById: Map<string, MovieItem>,
): PlayableItem[] {
  return collection.movieIds
    .map((id) => moviesById.get(id))
    .filter((m): m is MovieItem => Boolean(m))
    .map((m) => ({
      id: m.id,
      title: m.title,
      subtitle: collection.title,
      file: m.file,
      metadata: m.metadata,
      kind: 'video' as const,
    }))
}
