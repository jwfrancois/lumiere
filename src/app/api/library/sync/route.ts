import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/library/sync
 *
 * Full library sync — upserts all library data to Neon.
 * Called periodically (debounced) and on major changes.
 *
 * Body: {
 *   userId: string,
 *   folders: [...],
 *   files: [...],
 *   rawMetadata: { fileId: { ... } },
 *   enrichment: { key: { ... } },
 *   collections: [...],
 *   listeningHistory: [...],
 *   tags: [...],
 * }
 *
 * Uses upsert semantics — existing data is updated, new data is created.
 */

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, folders, files, rawMetadata, enrichment, collections } = body

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Verify user exists
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 401 })
  }

  // ── Sync folders ───────────────────────────────────────────────────
  // Delete folders not in the new set, then upsert all
  const folderIds = folders.map((f: { id: string }) => f.id)
  await db.folder.deleteMany({
    where: { userId, NOT: { id: { in: folderIds } } },
  })
  for (const folder of folders) {
    await db.folder.upsert({
      where: { id: folder.id },
      create: {
        id: folder.id,
        name: folder.name,
        fileCount: folder.fileCount,
        hasFsaHandle: folder.hasFsaHandle || false,
        userId,
      },
      update: {
        name: folder.name,
        fileCount: folder.fileCount,
        hasFsaHandle: folder.hasFsaHandle || false,
      },
    })
  }

  // ── Sync files ─────────────────────────────────────────────────────
  const fileIds = files.map((f: { id: string }) => f.id)
  await db.fileEntry.deleteMany({
    where: { userId, NOT: { id: { in: fileIds } } },
  })
  for (const file of files) {
    await db.fileEntry.upsert({
      where: { id: file.id },
      create: {
        id: file.id,
        name: file.name,
        path: file.path,
        kind: file.kind,
        size: BigInt(file.size),
        folderId: file.folderId,
        userId,
      },
      update: {
        name: file.name,
        path: file.path,
        kind: file.kind,
        size: BigInt(file.size),
        folderId: file.folderId,
      },
    })

    // Upsert metadata
    const meta = rawMetadata[file.id]
    if (meta) {
      await db.fileMetadata.upsert({
        where: { fileId: file.id },
        create: {
          fileId: file.id,
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          albumArtist: meta.albumArtist,
          year: meta.year,
          trackNumber: meta.trackNumber,
          trackTotal: meta.trackTotal,
          durationSec: meta.durationSec,
          genre: meta.genre,
          showName: meta.showName,
          seasonNumber: meta.seasonNumber,
          episodeNumber: meta.episodeNumber,
          description: meta.description,
          composer: meta.composer,
          copyright: meta.copyright,
          container: meta.container,
          audioCodec: meta.audioCodec,
          videoCodec: meta.videoCodec,
          width: meta.width,
          height: meta.height,
          bitrate: meta.bitrate,
          sampleRate: meta.sampleRate,
          channels: meta.channels,
        },
        update: {
          title: meta.title,
          artist: meta.artist,
          album: meta.album,
          albumArtist: meta.albumArtist,
          year: meta.year,
          trackNumber: meta.trackNumber,
          durationSec: meta.durationSec,
          genre: meta.genre,
          showName: meta.showName,
          seasonNumber: meta.seasonNumber,
          episodeNumber: meta.episodeNumber,
          description: meta.description,
          composer: meta.composer,
          container: meta.container,
          audioCodec: meta.audioCodec,
          videoCodec: meta.videoCodec,
          width: meta.width,
          height: meta.height,
          sampleRate: meta.sampleRate,
          channels: meta.channels,
        },
      })
    }
  }

  // ── Sync enrichment ────────────────────────────────────────────────
  for (const [key, info] of Object.entries(enrichment)) {
    const e = info as Record<string, unknown>
    await db.enrichment.upsert({
      where: { id: key },
      create: {
        id: key,
        userId,
        posterUrl: e.posterUrl as string | null,
        imdbRating: e.imdbRating as number | null,
        rottenTomatoes: e.rottenTomatoes as number | null,
        metacritic: e.metacritic as number | null,
        plot: e.plot as string | null,
        genre: e.genre as string | null,
        runtime: e.runtime as string | null,
        rated: e.rated as string | null,
        director: e.director as string | null,
        cast: e.cast as string | null,
        awards: e.awards as string | null,
        totalSeasons: e.totalSeasons as number | null,
        artworkUrl: e.artworkUrl as string | null,
        artworkUrlHiRes: e.artworkUrlHiRes as string | null,
        copyright: e.copyright as string | null,
        itunesUrl: e.itunesUrl as string | null,
        photoUrl: e.photoUrl as string | null,
        bio: e.bio as string | null,
        description: e.description as string | null,
      },
      update: {
        posterUrl: e.posterUrl as string | null,
        imdbRating: e.imdbRating as number | null,
        rottenTomatoes: e.rottenTomatoes as number | null,
        metacritic: e.metacritic as number | null,
        plot: e.plot as string | null,
        genre: e.genre as string | null,
        runtime: e.runtime as string | null,
        rated: e.rated as string | null,
        director: e.director as string | null,
        cast: e.cast as string | null,
        awards: e.awards as string | null,
        totalSeasons: e.totalSeasons as number | null,
        artworkUrl: e.artworkUrl as string | null,
        artworkUrlHiRes: e.artworkUrlHiRes as string | null,
        copyright: e.copyright as string | null,
        itunesUrl: e.itunesUrl as string | null,
        photoUrl: e.photoUrl as string | null,
        bio: e.bio as string | null,
        description: e.description as string | null,
      },
    })
  }

  // ── Sync collections ───────────────────────────────────────────────
  const collectionIds = collections.map((c: { id: string }) => c.id)
  await db.collection.deleteMany({
    where: { userId, NOT: { id: { in: collectionIds } } },
  })
  for (const coll of collections) {
    await db.collection.upsert({
      where: { id: coll.id },
      create: {
        id: coll.id,
        title: coll.title,
        userId,
        movieIds: coll.movieIds,
        coverUrl: coll.coverUrl,
        year: coll.year,
      },
      update: {
        title: coll.title,
        movieIds: coll.movieIds,
        coverUrl: coll.coverUrl,
        year: coll.year,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
