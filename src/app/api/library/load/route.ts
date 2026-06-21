import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/library/load?userId=xxx
 *
 * Loads the entire library from Neon for the given user.
 * Returns all folders, files, metadata, enrichment, collections,
 * listening history, and tags in a single response.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      folders: true,
      files: { include: { metadata: true } },
      enrichments: true,
      collections: true,
      history: true,
      tags: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Transform DB rows back into the store's expected format
  const folders = user.folders.map((f) => ({
    id: f.id,
    name: f.name,
    fileCount: f.fileCount,
    scannedAt: f.scannedAt.getTime(),
    hasFsaHandle: f.hasFsaHandle,
  }))

  const files = user.files.map((f) => ({
    id: f.id,
    name: f.name,
    path: f.path,
    kind: f.kind,
    size: Number(f.size),
    folderId: f.folderId,
  }))

  const rawMetadata: Record<string, unknown> = {}
  for (const f of user.files) {
    if (f.metadata) {
      const m = f.metadata
      rawMetadata[f.id] = {
        title: m.title || undefined,
        artist: m.artist || undefined,
        album: m.album || undefined,
        albumArtist: m.albumArtist || undefined,
        year: m.year || undefined,
        trackNumber: m.trackNumber || undefined,
        trackTotal: m.trackTotal || undefined,
        durationSec: m.durationSec || undefined,
        genre: m.genre || undefined,
        showName: m.showName || undefined,
        seasonNumber: m.seasonNumber || undefined,
        episodeNumber: m.episodeNumber || undefined,
        description: m.description || undefined,
        composer: m.composer || undefined,
        copyright: m.copyright || undefined,
        container: m.container || undefined,
        audioCodec: m.audioCodec || undefined,
        videoCodec: m.videoCodec || undefined,
        width: m.width || undefined,
        height: m.height || undefined,
        bitrate: m.bitrate || undefined,
        sampleRate: m.sampleRate || undefined,
        channels: m.channels || undefined,
      }
    }
  }

  const enrichment: Record<string, unknown> = {}
  for (const e of user.enrichments) {
    enrichment[e.id] = {
      posterUrl: e.posterUrl || undefined,
      imdbRating: e.imdbRating || undefined,
      rottenTomatoes: e.rottenTomatoes || undefined,
      metacritic: e.metacritic || undefined,
      plot: e.plot || undefined,
      genre: e.genre || undefined,
      runtime: e.runtime || undefined,
      rated: e.rated || undefined,
      director: e.director || undefined,
      cast: e.cast || undefined,
      awards: e.awards || undefined,
      totalSeasons: e.totalSeasons || undefined,
      artworkUrl: e.artworkUrl || undefined,
      artworkUrlHiRes: e.artworkUrlHiRes || undefined,
      copyright: e.copyright || undefined,
      itunesUrl: e.itunesUrl || undefined,
      photoUrl: e.photoUrl || undefined,
      bio: e.bio || undefined,
      description: e.description || undefined,
    }
  }

  const collections = user.collections.map((c) => ({
    id: c.id,
    title: c.title,
    movieIds: c.movieIds,
    coverUrl: c.coverUrl || undefined,
    year: c.year || undefined,
  }))

  const listeningHistory = {
    tracks: {} as Record<string, unknown>,
    events: [],
  }
  for (const h of user.history) {
    listeningHistory.tracks[h.trackId] = {
      playCount: h.playCount,
      firstPlayed: h.firstPlayed.getTime(),
      lastPlayed: h.lastPlayed.getTime(),
      totalDurationSec: h.totalDurationSec,
    }
  }

  const tags = {
    tags: {} as Record<string, string[]>,
    itemTags: {} as Record<string, string[]>,
  }
  for (const t of user.tags) {
    tags.tags[t.name] = t.itemIds
    for (const itemId of t.itemIds) {
      if (!tags.itemTags[itemId]) tags.itemTags[itemId] = []
      tags.itemTags[itemId].push(t.name)
    }
  }

  return NextResponse.json({
    folders,
    files,
    rawMetadata,
    enrichment,
    collections,
    listeningHistory,
    tags,
  })
}
