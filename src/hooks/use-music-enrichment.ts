'use client'

import { useEffect, useRef } from 'react'
import { useLibrary, type EnrichedInfo } from '@/store/library'
import type { MusicInfo } from '@/app/api/music/route'
import type { ArtistInfo } from '@/app/api/artist/route'

/**
 * Music enrichment orchestrator.
 *
 * Watches the library for albums and podcasts that lack enrichment,
 * then fetches:
 *  - Album artwork + metadata from iTunes (/api/music)
 *  - Artist bios + photos from Wikipedia + iTunes (/api/artist)
 *  - Podcast artwork from iTunes (/api/music with podcast flag)
 *
 * Rate-limited to 1 request every 500ms to be friendly with the APIs.
 */

const RATE_LIMIT_MS = 500

export function useMusicEnrichment() {
  const albums = useLibrary((s) => s.albums)
  const podcasts = useLibrary((s) => s.podcasts)
  const enrichment = useLibrary((s) => s.enrichment)
  const enriching = useLibrary((s) => s.enriching)

  const markEnriching = useLibrary((s) => s.markEnriching)
  const setEnrichment = useLibrary((s) => s.setEnrichment)
  const clearEnriching = useLibrary((s) => s.clearEnriching)
  const setIsEnriching = useLibrary((s) => s.setIsEnriching)

  const stateRef = useRef({
    albums,
    podcasts,
    enrichment,
    enriching,
    markEnriching,
    setEnrichment,
    clearEnriching,
    setIsEnriching,
  })
  stateRef.current = {
    albums,
    podcasts,
    enrichment,
    enriching,
    markEnriching,
    setEnrichment,
    clearEnriching,
    setIsEnriching,
  }

  const queuedRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)

  useEffect(() => {
    const s = stateRef.current
    const tasks: Array<{
      key: string
      type: 'album' | 'artist' | 'podcast'
      album?: string
      artist?: string
      name?: string
    }> = []

    // Albums needing artwork enrichment
    for (const album of s.albums) {
      const key = `album:${album.id}`
      if (s.enrichment[key] || s.enriching.has(key) || queuedRef.current.has(key)) {
        continue
      }
      // Skip if album already has embedded cover art
      if (album.coverUrl) continue
      tasks.push({
        key,
        type: 'album',
        album: album.title,
        artist: album.artist,
      })
    }

    // Artists needing bio enrichment (one per unique artist)
    const seenArtists = new Set<string>()
    for (const album of s.albums) {
      const artistKey = `artist:${album.artist.toLowerCase()}`
      if (seenArtists.has(artistKey)) continue
      seenArtists.add(artistKey)
      if (s.enrichment[artistKey] || s.enriching.has(artistKey) || queuedRef.current.has(artistKey)) {
        continue
      }
      tasks.push({
        key: artistKey,
        type: 'artist',
        name: album.artist,
      })
    }

    // Podcasts needing artwork enrichment
    for (const pod of s.podcasts) {
      const key = `podcast:${pod.id}`
      if (s.enrichment[key] || s.enriching.has(key) || queuedRef.current.has(key)) {
        continue
      }
      if (pod.coverUrl) continue
      tasks.push({
        key,
        type: 'podcast',
        name: pod.title,
      })
    }

    if (tasks.length === 0) return

    for (const t of tasks) queuedRef.current.add(t.key)

    if (runningRef.current) return
    runningRef.current = true
    setIsEnriching(true)

    void (async () => {
      while (true) {
        const s2 = stateRef.current
        const pending = [...queuedRef.current].filter(
          (k) => !s2.enrichment[k] && !s2.enriching.has(k),
        )
        if (pending.length === 0) break
        const key = pending[0]
        queuedRef.current.delete(key)

        const [type, ...rest] = key.split(':')
        const idOrName = rest.join(':')

        stateRef.current.markEnriching(key)

        try {
          if (type === 'album') {
            // Find the album to get title + artist
            const album = s2.albums.find((a) => a.id === idOrName)
            if (album) {
              const params = new URLSearchParams({
                album: album.title,
                artist: album.artist,
              })
              const res = await fetch(`/api/music?${params}`, {
                cache: 'no-store',
              })
              if (res.ok) {
                const data = (await res.json()) as MusicInfo
                if (data.found) {
                  const info: EnrichedInfo = {}
                  if (data.artworkUrlHiRes) info.artworkUrlHiRes = data.artworkUrlHiRes
                  if (data.artworkUrl) info.artworkUrl = data.artworkUrl
                  if (data.genre) info.genre = data.genre
                  if (data.year) info.plot = `Released ${data.year}`
                  if (data.copyright) info.copyright = data.copyright
                  if (data.itunesUrl) info.itunesUrl = data.itunesUrl
                  stateRef.current.setEnrichment(key, info)
                } else {
                  stateRef.current.setEnrichment(key, {})
                }
              }
            }
          } else if (type === 'artist') {
            const params = new URLSearchParams({ name: idOrName })
            const res = await fetch(`/api/artist?${params}`, {
              cache: 'no-store',
            })
            if (res.ok) {
              const data = (await res.json()) as ArtistInfo
              if (data.found) {
                const info: EnrichedInfo = {}
                if (data.photoUrl) info.photoUrl = data.photoUrl
                if (data.bio) info.bio = data.bio
                if (data.description) info.description = data.description
                if (data.genre) info.genre = data.genre
                if (data.itunesUrl) info.itunesUrl = data.itunesUrl
                stateRef.current.setEnrichment(key, info)
              } else {
                stateRef.current.setEnrichment(key, {})
              }
            }
          } else if (type === 'podcast') {
            // Use iTunes podcast search
            const pod = s2.podcasts.find((p) => p.id === idOrName)
            if (pod) {
              const term = encodeURIComponent(pod.title)
              const url = `https://itunes.apple.com/search?term=${term}&entity=podcast&limit=1`
              try {
                const res = await fetch(url, {
                  headers: { 'User-Agent': 'Lumiere/1.0' },
                  signal: AbortSignal.timeout(8000),
                })
                if (res.ok) {
                  const data = await res.json()
                  const result = data?.results?.[0]
                  if (result?.artworkUrl100) {
                    const info: EnrichedInfo = {
                      artworkUrl: result.artworkUrl100,
                      artworkUrlHiRes: result.artworkUrl100.replace(
                        /\/\d+x\d+bb\./,
                        '/600x600bb.',
                      ),
                    }
                    if (result.primaryGenreName) info.genre = result.primaryGenreName
                    if (result.trackCount) info.totalSeasons = result.trackCount
                    stateRef.current.setEnrichment(key, info)
                  } else {
                    stateRef.current.setEnrichment(key, {})
                  }
                }
              } catch {
                stateRef.current.setEnrichment(key, {})
              }
            }
          }
        } catch (err) {
          console.warn('music enrichment failed for', key, err)
        } finally {
          stateRef.current.clearEnriching(key)
        }

        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
      }
      runningRef.current = false
      stateRef.current.setIsEnriching(false)
    })()
  }, [albums, podcasts, enrichment, enriching, markEnriching, setEnrichment, clearEnriching, setIsEnriching])
}
