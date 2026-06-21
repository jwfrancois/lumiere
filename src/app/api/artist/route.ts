import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/artist?name=Pink+Floyd
 *
 * Fetches artist biography + photo from two free sources:
 *  1. Wikipedia REST API — bio extract + thumbnail photo
 *  2. iTunes Search API — genre + artist link
 *
 * No API key required. Responses cached for 24 hours.
 */

const CACHE_TTL = 24 * 60 * 60 * 1000
const cache = new Map<string, CachedEntry>()

interface CachedEntry {
  data: unknown
  expiresAt: number
}

export interface ArtistInfo {
  name: string
  photoUrl?: string
  bio?: string
  description?: string
  genre?: string
  itunesUrl?: string
  source: 'wikipedia+itunes'
  found: boolean
}

async function fetchWikiSummary(
  name: string,
): Promise<{
  photoUrl?: string
  bio?: string
  description?: string
} | null> {
  const encoded = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Lumiere/1.0 (https://github.com/lumiere-media-library; contact@lumiere.local)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.type === 'disambiguation') return null
    return {
      photoUrl: data.thumbnail?.source || data.originalimage?.source,
      bio: data.extract,
      description: data.description,
    }
  } catch {
    return null
  }
}

async function searchWikiByName(
  name: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${name} musician band`,
    srnamespace: '0',
    srlimit: '3',
    format: 'json',
    origin: '*',
  })
  const url = `https://en.wikipedia.org/w/api.php?${params}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Lumiere/1.0 (https://github.com/lumiere-media-library; contact@lumiere.local)',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    const results = data?.query?.search as Array<{ title: string }> | undefined
    if (!results || results.length === 0) return null
    return results[0].title
  } catch {
    return null
  }
}

async function fetchITunesArtist(
  name: string,
): Promise<{ genre?: string; itunesUrl?: string } | null> {
  const term = encodeURIComponent(name.trim())
  const url = `https://itunes.apple.com/search?term=${term}&entity=musicArtist&limit=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Lumiere/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.results?.[0]
    if (!result) return null
    return {
      genre: result.primaryGenreName,
      itunesUrl: result.artistLinkUrl,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawName = searchParams.get('name')

  if (!rawName) {
    return NextResponse.json(
      { error: 'Missing name parameter' },
      { status: 400 },
    )
  }

  const name = rawName.trim()
  const cacheKey = name.toLowerCase()

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  // Fetch from Wikipedia (bio + photo) and iTunes (genre + link) in parallel
  let wiki = await fetchWikiSummary(name)

  // If Wikipedia didn't find a photo, try the search API for a better title
  if (!wiki || !wiki.photoUrl) {
    const betterTitle = await searchWikiByName(name)
    if (betterTitle && betterTitle !== name) {
      const betterWiki = await fetchWikiSummary(betterTitle)
      if (betterWiki && (betterWiki.photoUrl || betterWiki.bio)) {
        wiki = betterWiki
      }
    }
  }

  const itunes = await fetchITunesArtist(name)

  if (!wiki && !itunes) {
    const notFound: ArtistInfo = {
      name,
      source: 'wikipedia+itunes',
      found: false,
    }
    cache.set(cacheKey, {
      data: notFound,
      expiresAt: Date.now() + CACHE_TTL,
    })
    return NextResponse.json(notFound, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  const info: ArtistInfo = {
    name,
    photoUrl: wiki?.photoUrl,
    bio: wiki?.bio,
    description: wiki?.description,
    genre: itunes?.genre,
    itunesUrl: itunes?.itunesUrl,
    source: 'wikipedia+itunes',
    found: true,
  }

  cache.set(cacheKey, { data: info, expiresAt: Date.now() + CACHE_TTL })

  return NextResponse.json(info, {
    headers: { 'Cache-Control': 'no-cache' },
  })
}
