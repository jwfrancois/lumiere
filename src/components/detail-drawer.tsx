'use client'

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
import { cn } from '@/lib/utils'

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
    title = movie.title
    description = movie.metadata.description || movie.metadata.artist || ''
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
        </div>

        <DetailMeta
          rows={[
            movie.year && { icon: Calendar, label: 'Year', value: String(movie.year) },
            movie.metadata.durationSec && {
              icon: Clock,
              label: 'Runtime',
              value: formatRuntimeLong(movie.metadata.durationSec),
            },
            movie.metadata.genre && { icon: Star, label: 'Genre', value: movie.metadata.genre },
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

        {description && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-amber-300/90">Synopsis</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {movie.metadata.composer && (
          <DetailMeta
            rows={[{ icon: User, label: 'Director', value: movie.metadata.composer }]}
          />
        )}

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
    title = collection.title
    description = `${collection.movieIds.length} movies in this collection`
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

        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-300/90 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Films in Collection ({collMovies.length})
          </h4>
          <div className="space-y-1.5">
            {collMovies.map((m, i) => (
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
                  <PosterArt coverUrl={m.coverUrl} title={m.title} kind="movie" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {m.year && <span>{m.year}</span>}
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
            ))}
          </div>
        </div>
      </div>
    )
  } else if (detailItem.kind === 'tv') {
    const show = tvShows.find((s) => s.id === detailItem.id)
    if (!show) return null
    title = show.title
    description = show.description || `${show.totalEpisodes} episodes across ${Object.keys(show.seasons).length} season${Object.keys(show.seasons).length > 1 ? 's' : ''}`
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
    coverUrl = m?.coverUrl
    kind = 'movie'
  } else if (detailItem.kind === 'collection') {
    const c = collections.find((x) => x.id === detailItem.id)
    coverUrl = c?.coverUrl
    kind = 'collection'
  } else if (detailItem.kind === 'tv') {
    const s = tvShows.find((x) => x.id === detailItem.id)
    coverUrl = s?.coverUrl
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
