import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/enrich?title=Inception&year=2010&kind=movie
 * GET /api/enrich?title=Stranger Things&kind=series
 *
 * Proxies OMDB (Open Movie Database) to enrich media items with posters,
 * ratings, plot, genre, runtime, etc. Uses a public demo API key.
 *
 * Responses are cached in-memory for 24 hours.
 *
 * No API key required from the user — this is a free public service.
 */

const OMDB_KEY = process.env.OMDB_API_KEY || 'thewdb'

interface CachedEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CachedEntry>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface OmdbResponse {
  Title?: string
  Year?: string
  Rated?: string
  Released?: string
  Runtime?: string
  Genre?: string
  Director?: string
  Writer?: string
  Actors?: string
  Plot?: string
  Language?: string
  Country?: string
  Awards?: string
  Poster?: string
  Ratings?: { Source: string; Value: string }[]
  Metascore?: string
  imdbRating?: string
  imdbVotes?: string
  imdbID?: string
  Type?: string
  totalSeasons?: string
  Response: string
  Error?: string
}

export interface EnrichedMetadata {
  title: string
  year?: number
  rated?: string
  runtime?: string
  genre?: string
  director?: string
  cast?: string
  plot?: string
  posterUrl?: string
  imdbRating?: number
  rottenTomatoes?: number
  metacritic?: number
  awards?: string
  type?: 'movie' | 'series'
  totalSeasons?: number
  source: 'omdb'
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '') // strip parentheticals
    .replace(/\s+(1080p|720p|480p|2160p|4k|uhd|hdr|bluray|web-dl|webrip|x264|x265|h264|h265|hevc|aac|ac3|dts|5\.1|7\.1|imax|extended|unrated|remastered|directors|cut|repack|proper)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseYear(yearStr?: string): number | undefined {
  if (!yearStr) return undefined
  // "2010" or "2010–2013" or "2016–"
  const m = yearStr.match(/(\d{4})/)
  return m ? parseInt(m[1], 10) : undefined
}

function parseRating(ratingStr?: string): number | undefined {
  if (!ratingStr || ratingStr === 'N/A') return undefined
  const v = parseFloat(ratingStr)
  return isFinite(v) ? v : undefined
}

async function fetchOmdb(
  title: string,
  year: number | undefined,
  kind: 'movie' | 'series' | undefined,
): Promise<OmdbResponse | null> {
  const params = new URLSearchParams({
    apikey: OMDB_KEY,
    t: title,
    plot: 'full',
  })
  if (year) params.set('y', String(year))
  if (kind === 'series') params.set('type', 'series')
  if (kind === 'movie') params.set('type', 'movie')

  const url = `https://www.omdbapi.com/?${params.toString()}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Lumiere/1.0 (local media library)' },
    })
    if (!res.ok) return null
    return (await res.json()) as OmdbResponse
  } catch (err) {
    console.error('OMDB fetch failed:', err)
    return null
  }
}

function transform(data: OmdbResponse): EnrichedMetadata | null {
  if (data.Response !== 'True' || !data.Title) return null
  const out: EnrichedMetadata = {
    title: data.Title,
    source: 'omdb',
  }
  const year = parseYear(data.Year)
  if (year) out.year = year
  if (data.Rated && data.Rated !== 'N/A') out.rated = data.Rated
  if (data.Runtime && data.Runtime !== 'N/A') out.runtime = data.Runtime
  if (data.Genre && data.Genre !== 'N/A') out.genre = data.Genre
  if (data.Director && data.Director !== 'N/A') out.director = data.Director
  if (data.Actors && data.Actors !== 'N/A') out.cast = data.Actors
  if (data.Plot && data.Plot !== 'N/A') out.plot = data.Plot
  if (data.Poster && data.Poster !== 'N/A') out.posterUrl = data.Poster
  if (data.Awards && data.Awards !== 'N/A') out.awards = data.Awards
  if (data.totalSeasons && data.totalSeasons !== 'N/A') {
    out.totalSeasons = parseInt(data.totalSeasons, 10)
  }
  if (data.Type === 'movie' || data.Type === 'series') {
    out.type = data.Type
  }
  const imdb = parseRating(data.imdbRating)
  if (imdb !== undefined) out.imdbRating = imdb
  if (data.Ratings) {
    for (const r of data.Ratings) {
      if (r.Source === 'Rotten Tomatoes') {
        const m = r.Value.match(/(\d+)%/)
        if (m) out.rottenTomatoes = parseInt(m[1], 10)
      } else if (r.Source === 'Metacritic') {
        const m = r.Value.match(/(\d+)/)
        if (m) out.metacritic = parseInt(m[1], 10)
      }
    }
  }
  return out
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawTitle = searchParams.get('title')
  const yearStr = searchParams.get('year')
  const kind = searchParams.get('kind') as 'movie' | 'series' | null

  if (!rawTitle) {
    return NextResponse.json(
      { error: 'Missing title parameter' },
      { status: 400 },
    )
  }

  const title = cleanTitle(rawTitle)
  const year = yearStr ? parseInt(yearStr, 10) : undefined
  const cacheKey = `${title}|${year || ''}|${kind || ''}`

  // Cache hit?
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  }

  // Try with year first, then without (year from filename may be wrong)
  let data = await fetchOmdb(title, year, kind || undefined)
  let result = data ? transform(data) : null

  // Fallback: try without year filter
  if (!result && year) {
    data = await fetchOmdb(title, undefined, kind || undefined)
    result = data ? transform(data) : null
  }

  // Fallback: try with the raw (less-aggressively cleaned) title
  if (!result && title !== rawTitle) {
    data = await fetchOmdb(rawTitle, year, kind || undefined)
    result = data ? transform(data) : null
  }

  if (!result) {
    const notFound = { found: false, title, source: 'omdb' as const }
    cache.set(cacheKey, {
      data: notFound,
      expiresAt: Date.now() + CACHE_TTL,
    })
    return NextResponse.json(notFound, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  }

  cache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL,
  })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  })
}
