'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  ListPlus,
  Calendar,
  Clock,
  User,
  Disc3,
  Layers,
  Mic,
  Tv,
  Star,
  FolderPlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useLibrary, useMoviesByIdMap } from '@/store/library'
import { PosterArt } from './poster-art'
import { HiFiBadge } from './hifi-badge'
import { formatDuration, formatRuntimeLong } from '@/lib/metadata'
import {
  buildAlbumQueue,
  buildShowQueue,
  buildPodcastQueue,
  buildCollectionQueue,
} from '@/lib/categorize'
import { CollectionManager } from './collection-manager'
import { CastBrowser } from './cast-browser'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function DetailDrawer() {
  const detailItem = useLibrary((s) => s.detailItem)
  const closeDetail = useLibrary((s) => s.closeDetail)
  const movies = useLibrary((s) => s.movies)
  const collections = useLibrary((s) => s.collections)
  const tvShows = useLibrary((s) => s.tvShows)
  const albums = useLibrary((s) => s.albums)
  const podcasts = useLibrary((s) => s.podcasts)
  const playQueue = useLibrary((s) => s.playQueue)
  const playNext = useLibrary((s) => s.playNext)
  const moviesById = useMoviesByIdMap()
  const removeFromCollection = useLibrary((s) => s.removeFromCollection)
  const renameCollection = useLibrary((s) => s.renameCollection)
  const deleteCollection = useLibrary((s) => s.deleteCollection)

  // State for the collection manager dialog (add-to-collection flow)
  const [collectionManagerOpen, setCollectionManagerOpen] = useState(false)
  const [collectionManagerTarget, setCollectionManagerTarget] = useState<
    string | undefined
  >(undefined)

  const open = detailItem !== null
  if (!detailItem) {
    return (
      <Sheet open={false} onOpenChange={() => closeDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    )
  }

  let content: React.ReactNode = null
  let title = ''
  let description = ''

  if (detailItem.kind === 'movie') {
    const movie = movies.find((m) => m.id === detailItem.id)
    if (!movie) return null
    // Look up enrichment (OMDB data: poster, IMDb/RT/Metacritic, plot, etc.)
    const enrichmentKey = `movie:${movie.id}`
    const enrich = useLibrary.getState().enrichment[enrichmentKey]
    title = movie.title
    description =
      enrich?.plot || movie.metadata.description || movie.metadata.artist || ''
    content = (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() =>
              playQueue([
                {
                  id: movie.id,
                  title: movie.title,
                  subtitle: '',
                  file: movie.file,
                  metadata: movie.metadata,
                  kind: 'video',
                },
              ])
            }
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Play className="w-4 h-4 fill-current" /> Play Movie
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              playNext([
                {
                  id: movie.id,
                  title: movie.title,
                  subtitle: '',
                  file: movie.file,
                  metadata: movie.metadata,
                  kind: 'video',
                },
              ])
            }
          >
            <ListPlus className="w-4 h-4" /> Queue
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCollectionManagerTarget(undefined)
              setCollectionManagerOpen(true)
            }}
            title="Add to a collection"
          >
            <FolderPlus className="w-4 h-4" /> Collection
          </Button>
        </div>

        {/* If this movie is already in a collection, show which one */}
        {movie.collectionId &&
          (() => {
            const coll = collections.find((c) => c.id === movie.collectionId)
            if (!coll) return null
            return (
              <div className="rounded-lg bg-muted/40 border border-border/40 p-2.5 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    In collection
                  </div>
                  <div className="text-sm font-medium truncate">{coll.title}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                  onClick={() => {
                    removeFromCollection(coll.id, movie.id)
                    toast.success(`Removed "${movie.title}" from "${coll.title}"`)
                  }}
                >
                  <X className="w-3 h-3" /> Remove
                </Button>
              </div>
            )
          })()}

        {/* Ratings row — IMDb / RT / Metacritic */}
        {(enrich?.imdbRating !== undefined ||
          enrich?.rottenTomatoes !== undefined ||
          enrich?.metacritic !== undefined) && (
          <div className="flex gap-2">
            {enrich?.imdbRating !== undefined && (
              <RatingPill label="IMDb" value={enrich.imdbRating.toFixed(1)} color="amber" />
            )}
            {enrich?.rottenTomatoes !== undefined && (
              <RatingPill label="RT" value={`${enrich.rottenTomatoes}%`} color="rose" />
            )}
            {enrich?.metacritic !== undefined && (
              <RatingPill label="Metacritic" value={String(enrich.metacritic)} color="emerald" />
            )}
          </div>
        )}

        <DetailMeta
          rows={[
            (enrich?.year || movie.year) && { icon: Calendar, label: 'Year', value: String(enrich?.year || movie.year) },
            (enrich?.runtime || movie.metadata.durationSec) && {
              icon: Clock,
              label: 'Runtime',
              value: enrich?.runtime || formatRuntimeLong(movie.metadata.durationSec),
            },
            (enrich?.genre || movie.metadata.genre) && {
              icon: Star,
              label: 'Genre',
              value: enrich?.genre || movie.metadata.genre || '',
            },
            enrich?.rated && enrich.rated !== 'N/A' && {
              icon: Tv,
              label: 'Rated',
              value: enrich.rated,
            },
            movie.metadata.videoCodec && {
              icon: Tv,
              label: 'Video',
              value: movie.metadata.videoCodec.toUpperCase(),
            },
            movie.metadata.audioCodec && {
              icon: Mic,
              label: 'Audio',
              value: movie.metadata.audioCodec.toUpperCase(),
            },
            movie.metadata.width && movie.metadata.height && {
              icon: Layers,
              label: 'Resolution',
              value: `${movie.metadata.width}×${movie.metadata.height}`,
            },
          ].filter(Boolean) as { icon: typeof Calendar; label: string; value: string }[]}
        />

        {(description || enrich?.plot) && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-amber-300/90">Synopsis</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {enrich?.plot || description}
            </p>
          </div>
        )}

        {(enrich?.director || enrich?.cast || movie.metadata.composer) && (
          <DetailMeta
            rows={[
              (enrich?.director || movie.metadata.composer) && {
                icon: User,
                label: 'Director',
                value: enrich?.director || movie.metadata.composer || '',
              },
              enrich?.cast && { icon: User, label: 'Cast', value: enrich.cast },
            ].filter(Boolean) as { icon: typeof Calendar; label: string; value: string }[]}
          />
        )}

        {enrich?.awards && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Star className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-medium">
                Awards
              </div>
              <div className="text-xs text-foreground">{enrich.awards}</div>
            </div>
          </div>
        )}

        {/* Cast with photos + filmography (Roon/IMDb-style) */}
        <CastBrowser
          castString={enrich?.cast}
          currentItemId={movie.id}
          context="movie"
        />

        <div className="rounded-lg bg-muted/40 border border-border/40 p-3 text-xs">
          <div className="font-medium mb-1">File</div>
          <div className="font-mono text-[11px] text-muted-foreground break-all">
            {movie.file.path}
          </div>
        </div>
      </div>
    )
  } else if (detailItem.kind === 'collection') {
    const collection = collections.find((c) => c.id === detailItem.id)
    if (!collection) return null
    const enrich = useLibrary.getState().enrichment[`collection:${collection.id}`]
    title = collection.title
    description =
      enrich?.plot || `${collection.movieIds.length} movies in this collection`
    const collMovies = collection.movieIds
      .map((id) => moviesById.get(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
    content = (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() => playQueue(buildCollectionQueue(collection, moviesById))}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Play className="w-4 h-4 fill-current" /> Play Collection
          </Button>
          <Button
            variant="outline"
            onClick={() => playNext(buildCollectionQueue(collection, moviesById))}
          >
            <ListPlus className="w-4 h-4" /> Queue All
          </Button>
        </div>

        {/* Collection management row */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              const newTitle = window.prompt('Rename collection:', collection.title)
              if (newTitle && newTitle.trim() && newTitle !== collection.title) {
                renameCollection(collection.id, newTitle.trim())
                toast.success('Collection renamed')
              }
            }}
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setCollectionManagerTarget(collection.id)
              setCollectionManagerOpen(true)
            }}
          >
            <FolderPlus className="w-3.5 h-3.5" /> Add Movies
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => {
              if (
                window.confirm(
                  `Delete collection "${collection.title}"? The movies will remain in your library as standalone items.`,
                )
              ) {
                deleteCollection(collection.id)
                closeDetail()
                toast.success('Collection deleted')
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>

        {/* Ratings row */}
        {(enrich?.imdbRating !== undefined ||
          enrich?.rottenTomatoes !== undefined ||
          enrich?.metacritic !== undefined) && (
          <div className="flex gap-2">
            {enrich?.imdbRating !== undefined && (
              <RatingPill label="IMDb" value={enrich.imdbRating.toFixed(1)} color="amber" />
            )}
            {enrich?.rottenTomatoes !== undefined && (
              <RatingPill label="RT" value={`${enrich.rottenTomatoes}%`} color="rose" />
            )}
            {enrich?.metacritic !== undefined && (
              <RatingPill label="Metacritic" value={String(enrich.metacritic)} color="emerald" />
            )}
          </div>
        )}

        {enrich?.plot && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-amber-300/90">About the Collection</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {enrich.plot}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-300/90 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Films in Collection ({collMovies.length})
          </h4>
          <div className="space-y-1.5">
            {collMovies.map((m, i) => {
              const mEnrich = useLibrary.getState().enrichment[`movie:${m.id}`]
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const queue = buildCollectionQueue(collection, moviesById)
                    playQueue(queue, i)
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="w-12 h-16 rounded overflow-hidden bg-muted shrink-0">
                    <PosterArt
                      coverUrl={m.coverUrl || mEnrich?.posterUrl}
                      title={m.title}
                      kind="movie"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {m.year && <span>{m.year}</span>}
                      {mEnrich?.imdbRating !== undefined && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                          ★ {mEnrich.imdbRating.toFixed(1)}
                        </span>
                      )}
                      {m.metadata.durationSec && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(m.metadata.durationSec)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  } else if (detailItem.kind === 'tv') {
    const show = tvShows.find((s) => s.id === detailItem.id)
    if (!show) return null
    const enrich = useLibrary.getState().enrichment[`tv:${show.id}`]
    title = show.title
    description =
      enrich?.plot ||
      show.description ||
      `${show.totalEpisodes} episodes across ${Object.keys(show.seasons).length} season${Object.keys(show.seasons).length > 1 ? 's' : ''}`
    const seasons = Object.keys(show.seasons).map(Number).sort((a, b) => a - b)
    content = (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() => playQueue(buildShowQueue(show))}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Play className="w-4 h-4 fill-current" /> Play Pilot
          </Button>
          <Button
            variant="outline"
            onClick={() => playNext(buildShowQueue(show))}
          >
            <ListPlus className="w-4 h-4" /> Queue All
          </Button>
        </div>

        {/* Ratings row — IMDb / RT / Metacritic */}
        {(enrich?.imdbRating !== undefined ||
          enrich?.rottenTomatoes !== undefined ||
          enrich?.metacritic !== undefined) && (
          <div className="flex gap-2">
            {enrich?.imdbRating !== undefined && (
              <RatingPill label="IMDb" value={enrich.imdbRating.toFixed(1)} color="amber" />
            )}
            {enrich?.rottenTomatoes !== undefined && (
              <RatingPill label="RT" value={`${enrich.rottenTomatoes}%`} color="rose" />
            )}
            {enrich?.metacritic !== undefined && (
              <RatingPill label="Metacritic" value={String(enrich.metacritic)} color="emerald" />
            )}
          </div>
        )}

        {/* Metadata row */}
        <DetailMeta
          rows={[
            (enrich?.year || show.year) && { icon: Calendar, label: 'Year', value: String(enrich?.year || show.year) },
            enrich?.runtime && { icon: Clock, label: 'Runtime', value: enrich.runtime },
            (enrich?.genre || show.genre) && { icon: Star, label: 'Genre', value: enrich?.genre || show.genre || '' },
            enrich?.rated && enrich.rated !== 'N/A' && { icon: Tv, label: 'Rated', value: enrich.rated },
            enrich?.totalSeasons && { icon: Layers, label: 'Seasons', value: String(enrich.totalSeasons) },
            { icon: Tv, label: 'Episodes', value: String(show.totalEpisodes) },
            enrich?.director && { icon: User, label: 'Creator', value: enrich.director },
          ].filter(Boolean) as { icon: typeof Calendar; label: string; value: string }[]}
        />

        {/* Synopsis */}
        {(enrich?.plot || description) && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-amber-300/90">Synopsis</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {enrich?.plot || description}
            </p>
          </div>
        )}

        {/* Awards */}
        {enrich?.awards && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Star className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-medium">
                Awards
              </div>
              <div className="text-xs text-foreground">{enrich.awards}</div>
            </div>
          </div>
        )}

        {/* Cast with photos + filmography */}
        <CastBrowser
          castString={enrich?.cast}
          currentItemId={show.id}
          context="tv"
        />

        {/* Seasons + Episodes */}
        {seasons.map((s) => (
          <div key={s}>
            <h4 className="text-sm font-semibold mb-2 text-amber-300/90 flex items-center gap-2">
              <Tv className="w-4 h-4" />
              Season {s}
              <Badge variant="secondary" className="ml-1">
                {show.seasons[s].length} eps
              </Badge>
            </h4>
            <div className="space-y-1">
              {show.seasons[s].map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    const queue = buildShowQueue(show, ep.id)
                    playQueue(queue, 0)
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                    {ep.episodeNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {ep.metadata.title || `Episode ${ep.episodeNumber}`}
                    </div>
                    {ep.metadata.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {ep.metadata.description}
                      </div>
                    )}
                  </div>
                  {ep.metadata.durationSec && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {formatDuration(ep.metadata.durationSec)}
                    </span>
                  )}
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  } else if (detailItem.kind === 'album') {
    const album = albums.find((a) => a.id === detailItem.id)
    if (!album) return null
    title = album.title
    description = `by ${album.artist}${album.year ? ` · ${album.year}` : ''}`
    content = (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() => playQueue(buildAlbumQueue(album))}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Play className="w-4 h-4 fill-current" /> Play Album
          </Button>
          <Button variant="outline" onClick={() => playNext(buildAlbumQueue(album))}>
            <ListPlus className="w-4 h-4" /> Queue All
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-300/90 flex items-center gap-2">
            <Disc3 className="w-4 h-4" />
            Track Listing
          </h4>
          <div className="space-y-0.5">
            {album.tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  const queue = buildAlbumQueue(album)
                  const idx = queue.findIndex((q) => q.id === t.id)
                  playQueue(queue, Math.max(0, idx))
                }}
                className="w-full grid grid-cols-[2rem_1fr_auto] items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="text-xs font-bold text-muted-foreground tabular-nums text-center">
                  {t.trackNumber}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.metadata.title}</div>
                  {t.metadata.composer && (
                    <div className="text-xs text-muted-foreground truncate">
                      {t.metadata.composer}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {t.metadata.durationSec && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatDuration(t.metadata.durationSec)}
                    </span>
                  )}
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {album.genre && (
          <DetailMeta rows={[{ icon: Star, label: 'Genre', value: album.genre }]} />
        )}
      </div>
    )
  } else if (detailItem.kind === 'podcast') {
    const pod = podcasts.find((p) => p.id === detailItem.id)
    if (!pod) return null
    title = pod.title
    description = pod.description || `${pod.totalEpisodes} episodes`
    content = (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() => playQueue(buildPodcastQueue(pod))}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            <Play className="w-4 h-4 fill-current" /> Play Latest
          </Button>
          <Button variant="outline" onClick={() => playNext(buildPodcastQueue(pod))}>
            <ListPlus className="w-4 h-4" /> Queue All
          </Button>
        </div>

        {pod.host && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            Hosted by <span className="text-foreground font-medium">{pod.host}</span>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-300/90 flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Episodes ({pod.episodes.length})
          </h4>
          <div className="space-y-1.5">
            {pod.episodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => {
                  const queue = buildPodcastQueue(pod, ep.id)
                  playQueue(queue, 0)
                }}
                className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                  {ep.episodeNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium line-clamp-1">
                    {ep.metadata.title || `Episode ${ep.episodeNumber}`}
                  </div>
                  {ep.metadata.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {ep.metadata.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground tabular-nums">
                    {ep.publishedAt && <span>{ep.publishedAt}</span>}
                    {ep.metadata.durationSec && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(ep.metadata.durationSec)}
                      </span>
                    )}
                  </div>
                </div>
                <Play className="w-4 h-4 text-muted-foreground group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Get cover art for header backdrop
  let coverUrl: string | undefined
  let kind: 'movie' | 'tv' | 'album' | 'podcast' | 'collection' = 'movie'
  if (detailItem.kind === 'movie') {
    const m = movies.find((x) => x.id === detailItem.id)
    const enrich = useLibrary.getState().enrichment[`movie:${detailItem.id}`]
    coverUrl = m?.coverUrl || enrich?.posterUrl
    kind = 'movie'
  } else if (detailItem.kind === 'collection') {
    const c = collections.find((x) => x.id === detailItem.id)
    const enrich = useLibrary.getState().enrichment[`collection:${detailItem.id}`]
    coverUrl = c?.coverUrl || enrich?.posterUrl
    kind = 'collection'
  } else if (detailItem.kind === 'tv') {
    const s = tvShows.find((x) => x.id === detailItem.id)
    const enrich = useLibrary.getState().enrichment[`tv:${detailItem.id}`]
    coverUrl = s?.coverUrl || enrich?.posterUrl
    kind = 'tv'
  } else if (detailItem.kind === 'album') {
    const a = albums.find((x) => x.id === detailItem.id)
    coverUrl = a?.coverUrl
    kind = 'album'
  } else if (detailItem.kind === 'podcast') {
    const p = podcasts.find((x) => x.id === detailItem.id)
    coverUrl = p?.coverUrl
    kind = 'podcast'
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeDetail()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 bg-card border-border/60"
      >
        {/* Hero header */}
        <div className="relative h-56 overflow-hidden">
          {coverUrl ? (
            <>
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/40" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-purple-700/20" />
          )}
          <div className="relative h-full flex items-end p-5 gap-4">
            <div className="w-28 h-40 rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl shrink-0">
              <PosterArt coverUrl={coverUrl} title={title} kind={kind} />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <SheetHeader className="space-y-1 p-0">
                <SheetTitle className="text-xl font-bold leading-tight line-clamp-3">
                  {title}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {description}
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                  {kind}
                </Badge>
                {kind === 'album' && <HiFiBadge />}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="h-[calc(100vh-14rem)]">
          <div className="p-5">{content}</div>
        </ScrollArea>
      </SheetContent>
      {collectionManagerOpen && (
        <CollectionManager
          key={`detail-cm-${detailItem?.id || 'new'}-${collectionManagerTarget || 'new'}`}
          open={collectionManagerOpen}
          onOpenChange={(o) => {
            setCollectionManagerOpen(o)
            if (!o) setCollectionManagerTarget(undefined)
          }}
          existingCollectionId={collectionManagerTarget}
          initialSelectedMovieIds={
            detailItem?.kind === 'movie' && !collectionManagerTarget
              ? [detailItem.id]
              : undefined
          }
        />
      )}
    </Sheet>
  )
}

function DetailMeta({
  rows,
}: {
  rows: { icon: typeof Calendar; label: string; value: string }[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => {
        const Icon = r.icon
        return (
          <div
            key={r.label}
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/40"
          >
            <Icon className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </div>
              <div className="text-xs font-medium truncate">{r.value}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RatingPill({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'amber' | 'rose' | 'emerald'
}) {
  const colorClasses = {
    amber: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    rose: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  }[color]
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClasses}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-70 font-medium">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  )
}
