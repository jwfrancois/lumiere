import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cast?name=Leonardo%20DiCaprio
 *
 * Fetches actor photo + bio from Wikipedia's REST API.
 * Returns:
 *  - name: the actor's name
 *  - photoUrl: thumbnail URL (if available)
 *  - bio: short extract
 *  - birthYear: if available from description
 *
 * No API key required — Wikipedia is free and open.
 * Responses are cached in-memory for 24 hours.
 */

const CACHE_TTL = 24 * 60 * 60 * 1000

interface CachedEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CachedEntry>()

interface WikiSummary {
  type?: string
  title?: string
  displaytitle?: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  extract?: string
  description?: string
}

export interface CastInfo {
  name: string
  photoUrl?: string
  bio?: string
  description?: string
  source: 'wikipedia'
  found: boolean
}

function normalizeName(name: string): string {
  // Wikipedia uses underscores for spaces in URLs
  return name.trim().replace(/\s+/g, '_')
}

async function fetchWikiSummary(name: string): Promise<WikiSummary | null> {
  const encoded = encodeURIComponent(normalizeName(name))
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
  try {
    const res = await fetch(url, {
      headers: {
        // Wikipedia requires a descriptive User-Agent with contact info.
        // Without it, they return 403 Forbidden.
        'User-Agent':
          'Lumiere/1.0 (https://github.com/lumiere-media-library; contact@lumiere.local)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`Wiki summary for "${name}" returned ${res.status}`)
      return null
    }
    const data = (await res.json()) as WikiSummary & { type?: string }
    if (data.type === 'disambiguation') return null
    return data
  } catch (err) {
    console.warn(`Wiki summary fetch failed for "${name}":`, err)
    return null
  }
}

async function searchWikiActor(name: string): Promise<string | null> {
  // If the direct summary doesn't work, try the search API to find the
  // most likely actor page (e.g., "Tom Hanks" might need disambiguation)
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${name} actor`,
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
    const results = data?.query?.search as Array<{ title: string; snippet: string }> | undefined
    if (!results || results.length === 0) return null
    // Return the first result title
    return results[0].title
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
  // Remove the cache-buster suffix (was needed to clear old 403 cache).
  const cacheKey = name.toLowerCase()

  // Cache hit?
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  // Try direct summary first
  let summary = await fetchWikiSummary(name)

  // If not found or no thumbnail, try search API
  if (!summary || (!summary.thumbnail && !summary.originalimage)) {
    const betterTitle = await searchWikiActor(name)
    if (betterTitle && betterTitle !== name) {
      const betterSummary = await fetchWikiSummary(betterTitle)
      if (betterSummary && (betterSummary.thumbnail || betterSummary.originalimage)) {
        summary = betterSummary
      }
    }
  }

  if (!summary) {
    const notFound: CastInfo = { name, source: 'wikipedia', found: false }
    cache.set(cacheKey, { data: notFound, expiresAt: Date.now() + CACHE_TTL })
    return NextResponse.json(notFound, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  const result: CastInfo = {
    name,
    photoUrl: summary.thumbnail?.source || summary.originalimage?.source,
    bio: summary.extract,
    description: summary.description,
    source: 'wikipedia',
    found: true,
  }

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  })
}
