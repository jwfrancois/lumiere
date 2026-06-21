'use client'

import { useEffect, useRef } from 'react'
import { useLibrary, type EnrichedInfo } from '@/store/library'
import type { EnrichedMetadata } from '@/app/api/enrich/route'

/**
 * Watches the library for new movies / TV shows / collections that lack
 * enrichment, then fetches metadata from /api/enrich (OMDB) for them.
 *
 * Enrichment runs in the background — the UI keeps showing the placeholder
 * art until a real poster arrives, at which point the affected cards
 * re-render with the new data.
 *
 * Rate-limited to 1 request every 400ms to stay friendly with OMDB.
 */

const RATE_LIMIT_MS = 400

interface EnrichTask {
  key: string
  title: string
  year?: number
  kind: 'movie' | 'series'
}

function stripSequelFromTitle(title: string): string {
  return title
    .replace(/\s+\d{1,2}$/, '')
    .replace(/\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3})$/, '')
    .replace(/\s+part\s+(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|\d{1,2})$/i, '')
    .trim()
}

export function useEnrichmentOrchestrator() {
  const movies = useLibrary((s) => s.movies)
  const tvShows = useLibrary((s) => s.tvShows)
  const collections = useLibrary((s) => s.collections)
  const enrichment = useLibrary((s) => s.enrichment)
  const enriching = useLibrary((s) => s.enriching)

  const markEnriching = useLibrary((s) => s.markEnriching)
  const setEnrichment = useLibrary((s) => s.setEnrichment)
  const clearEnriching = useLibrary((s) => s.clearEnriching)
  const setIsEnriching = useLibrary((s) => s.setIsEnriching)

  // Use refs so the running loop always sees fresh state without restarting.
  const stateRef = useRef({
    movies,
    tvShows,
    collections,
    enrichment,
    enriching,
    markEnriching,
    setEnrichment,
    clearEnriching,
    setIsEnriching,
  })
  stateRef.current = {
    movies,
    tvShows,
    collections,
    enrichment,
    enriching,
    markEnriching,
    setEnrichment,
    clearEnriching,
    setIsEnriching,
  }

  // Track the set of keys we've already queued, so we don't re-queue on
  // every store update.
  const queuedRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)

  useEffect(() => {
    const s = stateRef.current

    // Build the list of items that need enrichment.
    // - Each standalone movie gets its own enrichment.
    // - Each collection gets ONE enrichment (use the first movie's title
    //   with sequel number stripped, e.g. "Lord of the Rings").
    // - Each TV show gets enrichment as a series.
    const tasks: EnrichTask[] = []

    for (const movie of s.movies) {
      if (movie.collectionId) continue // collection members enrich via the collection
      const key = `movie:${movie.id}`
      if (s.enrichment[key] || s.enriching.has(key) || queuedRef.current.has(key)) {
        continue
      }
      tasks.push({
        key,
        title: movie.title,
        year: movie.year,
        kind: 'movie',
      })
    }

    for (const coll of s.collections) {
      const key = `collection:${coll.id}`
      if (s.enrichment[key] || s.enriching.has(key) || queuedRef.current.has(key)) {
        continue
      }
      // Use the collection title (already shared prefix) for lookup
      tasks.push({
        key,
        title: coll.title,
        year: coll.year,
        kind: 'movie',
      })
    }

    for (const show of s.tvShows) {
      const key = `tv:${show.id}`
      if (s.enrichment[key] || s.enriching.has(key) || queuedRef.current.has(key)) {
        continue
      }
      tasks.push({
        key,
        title: show.title,
        year: show.year,
        kind: 'series',
      })
    }

    if (tasks.length === 0) return

    // Mark all as queued so we don't re-add them
    for (const t of tasks) queuedRef.current.add(t.key)

    // Start the runner if it isn't already going.
    if (runningRef.current) return
    runningRef.current = true
    setIsEnriching(true)

    void (async () => {
      while (true) {
        // Find the next task that's still pending
        const s2 = stateRef.current
        const pending = [...queuedRef.current].filter((k) => {
          return (
            !s2.enrichment[k] &&
            !s2.enriching.has(k)
          )
        })
        if (pending.length === 0) break
        const key = pending[0]
        queuedRef.current.delete(key)

        // Reconstruct task info from the key + current store state
        const [kind, id] = key.split(':')
        let title: string | undefined
        let year: number | undefined
        let apiKind: 'movie' | 'series' = 'movie'

        if (kind === 'movie') {
          const m = s2.movies.find((x) => x.id === id)
          if (m) {
            title = m.title
            year = m.year
            apiKind = 'movie'
          }
        } else if (kind === 'collection') {
          const c = s2.collections.find((x) => x.id === id)
          if (c) {
            title = c.title
            year = c.year
            apiKind = 'movie'
          }
        } else if (kind === 'tv') {
          const t = s2.tvShows.find((x) => x.id === id)
          if (t) {
            title = t.title
            year = t.year
            apiKind = 'series'
          }
        }

        if (!title) {
          // Item may have been removed — mark empty enrichment so we don't retry
          stateRef.current.setEnrichment(key, {})
          continue
        }

        stateRef.current.markEnriching(key)
        try {
          const params = new URLSearchParams({
            title: stripSequelFromTitle(title),
          })
          if (year) params.set('year', String(year))
          params.set('kind', apiKind)
          const res = await fetch(`/api/enrich?${params.toString()}`)
          if (res.ok) {
            const data = (await res.json()) as EnrichedMetadata | { found: false }
            if ('found' in data && data.found === false) {
              // No result — record empty enrichment to avoid retrying
              stateRef.current.setEnrichment(key, {} as EnrichedInfo)
            } else if ((data as EnrichedMetadata).source === 'omdb') {
              const d = data as EnrichedMetadata
              const info: EnrichedInfo = {}
              if (d.posterUrl) info.posterUrl = d.posterUrl
              if (d.imdbRating !== undefined) info.imdbRating = d.imdbRating
              if (d.rottenTomatoes !== undefined) info.rottenTomatoes = d.rottenTomatoes
              if (d.metacritic !== undefined) info.metacritic = d.metacritic
              if (d.plot) info.plot = d.plot
              if (d.genre) info.genre = d.genre
              if (d.runtime) info.runtime = d.runtime
              if (d.rated) info.rated = d.rated
              if (d.director) info.director = d.director
              if (d.cast) info.cast = d.cast
              if (d.awards) info.awards = d.awards
              if (d.totalSeasons !== undefined) info.totalSeasons = d.totalSeasons
              stateRef.current.setEnrichment(key, info)
            }
          }
        } catch (err) {
          console.warn('enrichment failed for', key, err)
        } finally {
          stateRef.current.clearEnriching(key)
        }

        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
      }
      runningRef.current = false
      stateRef.current.setIsEnriching(false)
    })()
  }, [movies, tvShows, collections, enrichment, enriching, markEnriching, setEnrichment, clearEnriching, setIsEnriching])
}
