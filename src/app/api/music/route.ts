import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/music?album=The+Dark+Side+of+the+Moon&artist=Pink+Floyd
 *
 * Fetches album artwork, genre, release year, and track count from the
 * iTunes Search API (free, no API key required).
 *
 * Also fetches a high-res version of the artwork (600x600 instead of 100x100).
 *
 * Responses are cached in-memory for 24 hours.
 */

const CACHE_TTL = 24 * 60 * 60 * 1000

interface CachedEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CachedEntry>()

interface ITunesResult {
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  primaryGenreName?: string
  releaseDate?: string
  trackCount?: number
  collectionExplicitness?: string
  copyright?: string
  collectionViewUrl?: string
}

export interface MusicInfo {
  album: string
  artist: string
  artworkUrl?: string
  artworkUrlHiRes?: string
  genre?: string
  year?: number
  trackCount?: number
  copyright?: string
  itunesUrl?: string
  source: 'itunes'
  found: boolean
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '+')
}

function upgradeArtwork(url: string): string {
  // iTunes returns 100x100 by default; upgrade to 600x600 for crisp display
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.')
}

async function searchITunes(
  album: string,
  artist: string,
): Promise<ITunesResult | null> {
  // Search with both album + artist in the term
  const term = normalize(`${album} ${artist}`)
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=20`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Lumiere/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const results = data?.results as ITunesResult[] | undefined
    if (!results || results.length === 0) return null

    // Try to find an exact-ish match: same artist name
    const artistLower = artist.toLowerCase().trim()
    const exactMatch = results.find(
      (r) => r.artistName?.toLowerCase().trim() === artistLower,
    )
    if (exactMatch) return exactMatch

    // Fall back to first result that has artwork
    const withArt = results.find((r) => r.artworkUrl100)
    return withArt || results[0]
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawAlbum = searchParams.get('album')
  const rawArtist = searchParams.get('artist')

  if (!rawAlbum || !rawArtist) {
    return NextResponse.json(
      { error: 'Missing album or artist parameter' },
      { status: 400 },
    )
  }

  const album = rawAlbum.trim()
  const artist = rawArtist.trim()
  const cacheKey = `${album.toLowerCase()}|${artist.toLowerCase()}`

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  const result = await searchITunes(album, artist)

  if (!result) {
    const notFound: MusicInfo = {
      album,
      artist,
      source: 'itunes',
      found: false,
    }
    cache.set(cacheKey, { data: notFound, expiresAt: Date.now() + CACHE_TTL })
    return NextResponse.json(notFound, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  const info: MusicInfo = {
    album,
    artist,
    artworkUrl: result.artworkUrl100,
    artworkUrlHiRes: result.artworkUrl100
      ? upgradeArtwork(result.artworkUrl100)
      : undefined,
    genre: result.primaryGenreName,
    year: result.releaseDate
      ? parseInt(result.releaseDate.substring(0, 4), 10)
      : undefined,
    trackCount: result.trackCount,
    copyright: result.copyright,
    itunesUrl: result.collectionViewUrl,
    source: 'itunes',
    found: true,
  }

  cache.set(cacheKey, { data: info, expiresAt: Date.now() + CACHE_TTL })

  return NextResponse.json(info, {
    headers: { 'Cache-Control': 'no-cache' },
  })
}
