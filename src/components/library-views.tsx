'use client'

import { useMemo } from 'react'
import { useLibrary, type ViewName } from '@/store/library'
import { MediaCard } from './media-card'
import { PosterArt } from './poster-art'
import {
  buildAlbumQueue,
  buildShowQueue,
  buildPodcastQueue,
  buildCollectionQueue,
  type PlayableItem,
} from '@/lib/categorize'
import { useMoviesByIdMap } from '@/store/library'
import {
  Film,
  Layers,
  Tv,
  Music,
  Mic,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Search,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ----------------------------------------------------------------
 * Home view — featured carousel + continue watching + section rails
 * ---------------------------------------------------------------- */
export function HomeView({ onScanClick }: { onScanClick: () => void }) {
  const movies = useLibrary((s) => s.movies)
  const collections = useLibrary((s) => s.collections)
  const tvShows = useLibrary((s) => s.tvShows)
  const albums = useLibrary((s) => s.albums)
  const podcasts = useLibrary((s) => s.podcasts)
  const stats = useLibrary((s) => s.stats)
  const setView = useLibrary((s) => s.setView)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const moviesById = useMoviesByIdMap()

  const isEmpty =
    movies.length === 0 &&
    collections.length === 0 &&
    tvShows.length === 0 &&
    albums.length === 0 &&
    podcasts.length === 0

  if (isEmpty) {
    return <EmptyHome onScanClick={onScanClick} />
  }

  // Featured = first collection OR first movie OR first TV show with art
  const featured =
    collections[0] ||
    (movies.length > 0 ? movies[0] : undefined) ||
    (tvShows.length > 0 ? tvShows[0] : undefined)

  const featuredCover = featured?.coverUrl

  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      {featured && (
        <section className="relative h-[420px] md:h-[480px] -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-2 overflow-hidden">
          {featuredCover ? (
            <>
              <img
                src={featuredCover}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-rose-500/20 to-purple-700/30" />
          )}
          <div className="relative h-full max-w-3xl flex flex-col justify-end px-6 md:px-8 pb-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs uppercase tracking-widest text-amber-300/90 font-medium">
                Featured {featured.category === 'movie' && 'collection' in featured ? 'Collection' : featured.category}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-3">
              {featured.title}
            </h1>
            {featured.year && (
              <p className="text-sm text-muted-foreground mb-4">
                {featured.year}
                {'totalEpisodes' in featured && ` · ${featured.totalEpisodes} episodes`}
                {'tracks' in featured && ` · ${featured.tracks.length} tracks`}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  if ('movieIds' in featured) {
                    playQueue(buildCollectionQueue(featured, moviesById))
                  } else if ('seasons' in featured) {
                    playQueue(buildShowQueue(featured))
                  } else if ('tracks' in featured) {
                    playQueue(buildAlbumQueue(featured))
                  } else if ('episodes' in featured) {
                    playQueue(buildPodcastQueue(featured))
                  }
                }}
                className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold border-0"
              >
                <Sparkles className="w-4 h-4" /> Play Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  if ('movieIds' in featured) {
                    openDetail({ kind: 'collection', id: featured.id })
                  } else if ('seasons' in featured) {
                    openDetail({ kind: 'tv', id: featured.id })
                  } else if ('tracks' in featured) {
                    openDetail({ kind: 'album', id: featured.id })
                  } else if ('episodes' in featured) {
                    openDetail({ kind: 'podcast', id: featured.id })
                  } else {
                    openDetail({ kind: 'movie', id: featured.id })
                  }
                }}
                className="bg-black/40 backdrop-blur border-white/20 text-white hover:bg-black/60"
              >
                View Details
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Stats strip */}
      {stats && (
        <section className="px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Movies', value: stats.standaloneMovies, icon: Film, view: 'movies' as ViewName },
              { label: 'Collections', value: stats.collections, icon: Layers, view: 'collections' as ViewName },
              { label: 'TV Shows', value: stats.tvShows, icon: Tv, view: 'tv' as ViewName },
              { label: 'Albums', value: stats.albums, icon: Music, view: 'music' as ViewName },
              { label: 'Podcasts', value: stats.podcasts, icon: Mic, view: 'podcasts' as ViewName },
            ].map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.label}
                  onClick={() => setView(s.view)}
                  className="glass-panel rounded-xl p-4 text-left hover:border-amber-500/30 transition-colors group"
                >
                  <Icon className="w-5 h-5 text-amber-400 mb-2" />
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Movie collections rail */}
      {collections.length > 0 && (
        <Rail
          title="Movie Collections"
          icon={<Layers className="w-4 h-4 text-amber-400" />}
          onSeeAll={() => setView('collections')}
        >
          {collections.slice(0, 12).map((c) => (
            <div key={c.id} className="w-44 md:w-52 shrink-0">
              <MediaCard
                kind="collection"
                title={c.title}
                coverUrl={c.coverUrl}
                year={c.year}
                badge={`${c.movieIds.length} films`}
                aspect="portrait"
                onClick={() => openDetail({ kind: 'collection', id: c.id })}
                onPlay={() => playQueue(buildCollectionQueue(c, moviesById))}
              />
            </div>
          ))}
        </Rail>
      )}

      {/* Standalone movies rail */}
      {movies.filter((m) => !m.collectionId).length > 0 && (
        <Rail
          title="Standalone Movies"
          icon={<Film className="w-4 h-4 text-amber-400" />}
          onSeeAll={() => setView('movies')}
        >
          {movies
            .filter((m) => !m.collectionId)
            .slice(0, 12)
            .map((m) => (
              <div key={m.id} className="w-44 md:w-52 shrink-0">
                <MediaCard
                  kind="movie"
                  title={m.title}
                  coverUrl={m.coverUrl}
                  year={m.year}
                  durationSec={m.metadata.durationSec}
                  genre={m.genre}
                  aspect="portrait"
                  onClick={() => openDetail({ kind: 'movie', id: m.id })}
                  onPlay={() =>
                    playQueue([
                      {
                        id: m.id,
                        title: m.title,
                        file: m.file,
                        metadata: m.metadata,
                        kind: 'video',
                      },
                    ] as PlayableItem[])
                  }
                />
              </div>
            ))}
        </Rail>
      )}

      {/* TV shows rail */}
      {tvShows.length > 0 && (
        <Rail
          title="TV Shows"
          icon={<Tv className="w-4 h-4 text-amber-400" />}
          onSeeAll={() => setView('tv')}
        >
          {tvShows.slice(0, 12).map((s) => (
            <div key={s.id} className="w-44 md:w-52 shrink-0">
              <MediaCard
                kind="tv"
                title={s.title}
                coverUrl={s.coverUrl}
                year={s.year}
                badge={`${s.totalEpisodes} eps`}
                aspect="portrait"
                onClick={() => openDetail({ kind: 'tv', id: s.id })}
                onPlay={() => playQueue(buildShowQueue(s))}
              />
            </div>
          ))}
        </Rail>
      )}

      {/* Music albums rail */}
      {albums.length > 0 && (
        <Rail
          title="Music Albums"
          icon={<Music className="w-4 h-4 text-amber-400" />}
          onSeeAll={() => setView('music')}
        >
          {albums.slice(0, 12).map((a) => (
            <div key={a.id} className="w-44 md:w-52 shrink-0">
              <MediaCard
                kind="album"
                title={a.title}
                subtitle={a.artist}
                coverUrl={a.coverUrl}
                year={a.year}
                badge={`${a.tracks.length} tracks`}
                aspect="square"
                onClick={() => openDetail({ kind: 'album', id: a.id })}
                onPlay={() => playQueue(buildAlbumQueue(a))}
              />
            </div>
          ))}
        </Rail>
      )}

      {/* Podcasts rail */}
      {podcasts.length > 0 && (
        <Rail
          title="Podcasts"
          icon={<Mic className="w-4 h-4 text-amber-400" />}
          onSeeAll={() => setView('podcasts')}
        >
          {podcasts.slice(0, 12).map((p) => (
            <div key={p.id} className="w-44 md:w-52 shrink-0">
              <MediaCard
                kind="podcast"
                title={p.title}
                subtitle={p.host}
                coverUrl={p.coverUrl}
                year={p.year}
                badge={`${p.episodes.length} eps`}
                aspect="square"
                onClick={() => openDetail({ kind: 'podcast', id: p.id })}
                onPlay={() => playQueue(buildPodcastQueue(p))}
              />
            </div>
          ))}
        </Rail>
      )}
    </div>
  )
}

function EmptyHome({ onScanClick }: { onScanClick: () => void }) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-32 h-32 mb-6">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/30 to-rose-500/30 blur-2xl" />
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <Film className="w-14 h-14 text-black" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-3xl md:text-4xl font-bold mb-3 gradient-text-amber">
        Welcome to Lumière
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Your personal cinema and HiFi music hall. Scan your computer for movies,
        TV shows, music albums, and podcasts — Lumière will read the embedded
        metadata and build a stunning, browsable library.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-2xl">
        {[
          { icon: Film, label: 'Movies & Sequel Collections' },
          { icon: Tv, label: 'TV Shows & Episodes' },
          { icon: Music, label: 'Music Albums' },
          { icon: Mic, label: 'Podcast Episodes' },
        ].map((f) => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="glass-panel rounded-xl p-4 text-center"
            >
              <Icon className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <div className="text-xs text-muted-foreground">{f.label}</div>
            </div>
          )
        })}
      </div>
      <Button
        size="lg"
        onClick={onScanClick}
        className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold px-8"
      >
        Scan My Computer
      </Button>
    </div>
  )
}

/* ----------------------------------------------------------------
 * Generic rail component
 * ---------------------------------------------------------------- */
function Rail({
  title,
  icon,
  onSeeAll,
  children,
}: {
  title: string
  icon?: React.ReactNode
  onSeeAll?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="px-6 md:px-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {onSeeAll && (
          <Button variant="ghost" size="sm" onClick={onSeeAll} className="text-muted-foreground hover:text-amber-300">
            See All <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-slim pb-3 -mx-1 px-1">
        {children}
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
 * Movies view
 * ---------------------------------------------------------------- */
export function MoviesView() {
  const movies = useLibrary((s) => s.movies)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'year'>('title')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = movies.filter((m) => !m.collectionId)
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q))
    list = [...list].sort((a, b) => {
      if (sortBy === 'year') return (b.year || 0) - (a.year || 0)
      return a.title.localeCompare(b.title)
    })
    return list
  }, [movies, query, sortBy])

  return (
    <LibraryView
      title="Movies"
      icon={<Film className="w-5 h-5 text-amber-400" />}
      query={query}
      setQuery={setQuery}
      sortBy={sortBy}
      setSortBy={setSortBy}
      count={filtered.length}
      emptyHint="No standalone movies found — try scanning a different folder."
    >
      {filtered.map((m) => (
        <div key={m.id} className="w-40 md:w-48">
          <MediaCard
            kind="movie"
            title={m.title}
            coverUrl={m.coverUrl}
            year={m.year}
            durationSec={m.metadata.durationSec}
            genre={m.genre}
            aspect="portrait"
            onClick={() => openDetail({ kind: 'movie', id: m.id })}
            onPlay={() =>
              playQueue([
                {
                  id: m.id,
                  title: m.title,
                  file: m.file,
                  metadata: m.metadata,
                  kind: 'video',
                },
              ])
            }
          />
        </div>
      ))}
    </LibraryView>
  )
}

/* ----------------------------------------------------------------
 * Collections view
 * ---------------------------------------------------------------- */
export function CollectionsView() {
  const collections = useLibrary((s) => s.collections)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const moviesById = useMoviesByIdMap()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return collections
    return collections.filter((c) => c.title.toLowerCase().includes(q))
  }, [collections, query])

  return (
    <LibraryView
      title="Movie Collections"
      icon={<Layers className="w-5 h-5 text-amber-400" />}
      query={query}
      setQuery={setQuery}
      count={filtered.length}
      emptyHint="No movie collections detected. Lumière groups movies with sequel numbers (e.g. 'Movie 2', 'Movie III') into collections automatically."
    >
      {filtered.map((c) => (
        <div key={c.id} className="w-40 md:w-48">
          <MediaCard
            kind="collection"
            title={c.title}
            coverUrl={c.coverUrl}
            year={c.year}
            badge={`${c.movieIds.length} films`}
            aspect="portrait"
            onClick={() => openDetail({ kind: 'collection', id: c.id })}
            onPlay={() => playQueue(buildCollectionQueue(c, moviesById))}
          />
        </div>
      ))}
    </LibraryView>
  )
}

/* ----------------------------------------------------------------
 * TV Shows view
 * ---------------------------------------------------------------- */
export function TvView() {
  const tvShows = useLibrary((s) => s.tvShows)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return tvShows
    return tvShows.filter((s) => s.title.toLowerCase().includes(q))
  }, [tvShows, query])

  return (
    <LibraryView
      title="TV Shows"
      icon={<Tv className="w-5 h-5 text-amber-400" />}
      query={query}
      setQuery={setQuery}
      count={filtered.length}
      emptyHint="No TV shows found. Files matching S01E05 or 1x05 patterns will be grouped here."
    >
      {filtered.map((s) => (
        <div key={s.id} className="w-40 md:w-48">
          <MediaCard
            kind="tv"
            title={s.title}
            coverUrl={s.coverUrl}
            year={s.year}
            badge={`${s.totalEpisodes} eps`}
            aspect="portrait"
            onClick={() => openDetail({ kind: 'tv', id: s.id })}
            onPlay={() => playQueue(buildShowQueue(s))}
          />
        </div>
      ))}
    </LibraryView>
  )
}

/* ----------------------------------------------------------------
 * Music view (albums)
 * ---------------------------------------------------------------- */
export function MusicView() {
  const albums = useLibrary((s) => s.albums)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'year'>('artist')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = albums
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.artist.toLowerCase().includes(q),
      )
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'year') return (b.year || 0) - (a.year || 0)
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist)
      return a.title.localeCompare(b.title)
    })
    return list
  }, [albums, query, sortBy])

  return (
    <LibraryView
      title="Music"
      icon={<Music className="w-5 h-5 text-amber-400" />}
      query={query}
      setQuery={setQuery}
      sortBy={sortBy}
      setSortBy={setSortBy}
      sortOptions={[
        { value: 'artist', label: 'Artist' },
        { value: 'title', label: 'Album' },
        { value: 'year', label: 'Year' },
      ]}
      count={filtered.length}
      emptyHint="No music albums found. MP3/FLAC/M4A files with embedded ID3 tags will be grouped by album."
    >
      {filtered.map((a) => (
        <div key={a.id} className="w-40 md:w-48">
          <MediaCard
            kind="album"
            title={a.title}
            subtitle={a.artist}
            coverUrl={a.coverUrl}
            year={a.year}
            badge={`${a.tracks.length} tracks`}
            aspect="square"
            onClick={() => openDetail({ kind: 'album', id: a.id })}
            onPlay={() => playQueue(buildAlbumQueue(a))}
          />
        </div>
      ))}
    </LibraryView>
  )
}

/* ----------------------------------------------------------------
 * Podcasts view
 * ---------------------------------------------------------------- */
export function PodcastsView() {
  const podcasts = useLibrary((s) => s.podcasts)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return podcasts
    return podcasts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.host || '').toLowerCase().includes(q),
    )
  }, [podcasts, query])

  return (
    <LibraryView
      title="Podcasts"
      icon={<Mic className="w-5 h-5 text-amber-400" />}
      query={query}
      setQuery={setQuery}
      count={filtered.length}
      emptyHint="No podcasts detected. Long-form audio (25 min+) and files with 'podcast' or 'episode' in the name land here."
    >
      {filtered.map((p) => (
        <div key={p.id} className="w-40 md:w-48">
          <MediaCard
            kind="podcast"
            title={p.title}
            subtitle={p.host}
            coverUrl={p.coverUrl}
            year={p.year}
            badge={`${p.episodes.length} eps`}
            aspect="square"
            onClick={() => openDetail({ kind: 'podcast', id: p.id })}
            onPlay={() => playQueue(buildPodcastQueue(p))}
          />
        </div>
      ))}
    </LibraryView>
  )
}

/* ----------------------------------------------------------------
 * Shared library view chrome (header + search + grid)
 * ---------------------------------------------------------------- */
function LibraryView({
  title,
  icon,
  query,
  setQuery,
  sortBy,
  setSortBy,
  sortOptions,
  count,
  emptyHint,
  children,
}: {
  title: string
  icon: React.ReactNode
  query: string
  setQuery: (q: string) => void
  sortBy?: string
  setSortBy?: (s: any) => void
  sortOptions?: { value: string; label: string }[]
  count: number
  emptyHint: string
  children: React.ReactNode
}) {
  return (
    <div className="pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          {icon}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            ({count})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 w-44 md:w-56 bg-muted/50 border-border/40"
            />
          </div>
          {setSortBy && sortOptions && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-xs rounded-md bg-muted/50 border border-border/40 hover:bg-muted transition-colors focus-ring"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {children}
        </div>
      )}
    </div>
  )
}
