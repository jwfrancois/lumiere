'use client'

import { useMemo, useState } from 'react'
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
  ArrowRight,
  Search,
  Clock,
  Trophy,
  PlayCircle,
  Plus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NetflixHero } from './netflix-hero'
import { NetflixRail } from './netflix-rail'
import { NetflixCard } from './netflix-card'
import { Top10Rail } from './top10-rail'
import { GenreFilter, collectGenres } from './genre-filter'
import { SpotifyCard } from './spotify-card'
import { SpotifyRail } from './spotify-rail'
import {
  CollectionManager,
  CollectionsEmptyState,
} from './collection-manager'

/* ----------------------------------------------------------------
 * Home view — keeps the original dashboard style
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

  // Featured = first collection OR first movie OR first TV show with art
  const featured =
    collections[0] ||
    (movies.length > 0 ? movies[0] : undefined) ||
    (tvShows.length > 0 ? tvShows[0] : undefined)

  const featuredEnrichmentKey = featured
    ? 'movieIds' in featured
      ? `collection:${featured.id}`
      : 'seasons' in featured
        ? `tv:${featured.id}`
        : `movie:${featured.id}`
    : '__none__'
  const featuredEnrichment = useLibrary((s) => s.enrichment[featuredEnrichmentKey])
  const featuredCover = featured?.coverUrl || featuredEnrichment?.posterUrl

  if (isEmpty) {
    return <EmptyHome onScanClick={onScanClick} />
  }

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
                Featured {'movieIds' in featured ? 'Collection' : featured.category}
              </span>
              {featuredEnrichment?.imdbRating !== undefined && (
                <span className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur text-amber-300 border border-amber-500/30">
                  ★ {featuredEnrichment.imdbRating.toFixed(1)}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-3">
              {featured.title}
            </h1>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-3">
              {featured.year && <span>{featured.year}</span>}
              {featuredEnrichment?.rated && featuredEnrichment.rated !== 'N/A' && (
                <span className="px-1.5 py-0 rounded border border-white/30 text-[10px] uppercase">
                  {featuredEnrichment.rated}
                </span>
              )}
              {featuredEnrichment?.genre && <span>{featuredEnrichment.genre}</span>}
              {'totalEpisodes' in featured && ` · ${featured.totalEpisodes} episodes`}
              {'tracks' in featured && ` · ${featured.tracks.length} tracks`}
              {featuredEnrichment?.runtime && (
                <span>· {featuredEnrichment.runtime}</span>
              )}
            </div>
            {featuredEnrichment?.plot && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 max-w-2xl">
                {featuredEnrichment.plot}
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

      {/* Rails */}
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
                enrichmentKey={`collection:${c.id}`}
                onClick={() => openDetail({ kind: 'collection', id: c.id })}
                onPlay={() => playQueue(buildCollectionQueue(c, moviesById))}
              />
            </div>
          ))}
        </Rail>
      )}

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
                  enrichmentKey={`movie:${m.id}`}
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
                enrichmentKey={`tv:${s.id}`}
                onClick={() => openDetail({ kind: 'tv', id: s.id })}
                onPlay={() => playQueue(buildShowQueue(s))}
              />
            </div>
          ))}
        </Rail>
      )}

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
            <div key={f.label} className="glass-panel rounded-xl p-4 text-center">
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

/* =================================================================
 * NETFLIX-STYLE VIEWS (Movies, Collections, TV)
 * ================================================================= */

interface HeroItemData {
  id: string
  title: string
  year?: number
  coverUrl?: string
  kind: 'movie' | 'tv' | 'collection'
}

function buildHeroItems(
  items: HeroItemData[],
  kind: 'movie' | 'tv' | 'collection',
  openDetail: (item: { kind: 'movie' | 'collection' | 'tv'; id: string }) => void,
  playQueue: (items: PlayableItem[], start?: number) => void,
  getPlayItems: (item: HeroItemData) => PlayableItem[],
): Array<{
  id: string
  title: string
  year?: number
  coverUrl?: string
  enrichmentKey: string
  kind: 'movie' | 'tv' | 'collection'
  onPlay: () => void
  onDetails: () => void
}> {
  return items.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    coverUrl: item.coverUrl,
    enrichmentKey: `${kind}:${item.id}`,
    kind,
    onPlay: () => playQueue(getPlayItems(item)),
    onDetails: () => openDetail({ kind, id: item.id }),
  }))
}

/** Netflix-style Movies view */
export function MoviesView() {
  const movies = useLibrary((s) => s.movies)
  const enrichment = useLibrary((s) => s.enrichment)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const playNext = useLibrary((s) => s.playNext)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)

  const standalone = useMemo(
    () => movies.filter((m) => !m.collectionId),
    [movies],
  )

  const enrichmentKeys = useMemo(
    () => standalone.map((m) => `movie:${m.id}`),
    [standalone],
  )
  const allGenres = useMemo(
    () => collectGenres(enrichment, enrichmentKeys),
    [enrichment, enrichmentKeys],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = standalone
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q))
    if (genre) {
      list = list.filter((m) => {
        const e = enrichment[`movie:${m.id}`]
        return e?.genre?.includes(genre)
      })
    }
    // Sort by rating (highest first), then title
    return [...list].sort((a, b) => {
      const ra = enrichment[`movie:${a.id}`]?.imdbRating || 0
      const rb = enrichment[`movie:${b.id}`]?.imdbRating || 0
      if (rb !== ra) return rb - ra
      return a.title.localeCompare(b.title)
    })
  }, [standalone, query, genre, enrichment])

  // Top 10 by rating
  const top10 = useMemo(
    () =>
      [...standalone]
        .sort((a, b) => {
          const ra = enrichment[`movie:${a.id}`]?.imdbRating || 0
          const rb = enrichment[`movie:${b.id}`]?.imdbRating || 0
          return rb - ra
        })
        .slice(0, 10),
    [standalone, enrichment],
  )

  // Hero items (top 5 by rating)
  const heroItems = buildHeroItems(
    top10.slice(0, 5),
    'movie',
    openDetail,
    playQueue,
    (m) => {
      const movie = standalone.find((x) => x.id === m.id)
      return movie
        ? [
            {
              id: movie.id,
              title: movie.title,
              file: movie.file,
              metadata: movie.metadata,
              kind: 'video' as const,
            },
          ]
        : []
    },
  )

  if (standalone.length === 0) {
    return (
      <EmptyView
        title="Movies"
        hint="No standalone movies found — try scanning a different folder."
      />
    )
  }

  return (
    <div className="pb-12">
      {/* Hero */}
      <NetflixHero items={heroItems} />

      {/* Search + genre filter */}
      <div className="px-6 md:px-8 mb-6 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search movies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>
      <div className="px-6 md:px-8">
        <GenreFilter genres={allGenres} selected={genre} onSelect={setGenre} />
      </div>

      {/* Top 10 */}
      {top10.length > 0 && !query && !genre && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-6 md:px-8">
            <Trophy className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-xl md:text-2xl font-bold">Top 10 Movies Today</h2>
          </div>
          <Top10Rail
            items={top10.map((m) => ({
              id: m.id,
              title: m.title,
              coverUrl: m.coverUrl,
              kind: 'movie',
              enrichmentKey: `movie:${m.id}`,
              onClick: () => openDetail({ kind: 'movie', id: m.id }),
              onPlay: () =>
                playQueue([
                  {
                    id: m.id,
                    title: m.title,
                    file: m.file,
                    metadata: m.metadata,
                    kind: 'video',
                  },
                ]),
            }))}
          />
        </div>
      )}

      {/* Trending / All Movies rail */}
      <NetflixRail title={query || genre ? `Results (${filtered.length})` : 'Trending Now'} badge={!query && !genre ? 'Hot' : undefined}>
        {filtered.map((m) => (
          <NetflixCard
            key={m.id}
            title={m.title}
            year={m.year}
            coverUrl={m.coverUrl}
            kind="movie"
            enrichmentKey={`movie:${m.id}`}
            durationSec={m.metadata.durationSec}
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
            onQueue={() =>
              playNext([
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
        ))}
      </NetflixRail>

      {/* New Releases (sorted by year) */}
      {!query && !genre && (
        <NetflixRail title="New Releases">
          {[...standalone]
            .sort((a, b) => (b.year || 0) - (a.year || 0))
            .slice(0, 15)
            .map((m) => (
              <NetflixCard
                key={m.id}
                title={m.title}
                year={m.year}
                coverUrl={m.coverUrl}
                kind="movie"
                enrichmentKey={`movie:${m.id}`}
                durationSec={m.metadata.durationSec}
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
            ))}
        </NetflixRail>
      )}

      {/* By genre rails */}
      {!query && !genre &&
        allGenres.slice(0, 4).map((g) => {
          const inGenre = standalone.filter((m) => {
            const e = enrichment[`movie:${m.id}`]
            return e?.genre?.includes(g)
          })
          if (inGenre.length === 0) return null
          return (
            <NetflixRail key={g} title={g}>
              {inGenre.slice(0, 15).map((m) => (
                <NetflixCard
                  key={m.id}
                  title={m.title}
                  year={m.year}
                  coverUrl={m.coverUrl}
                  kind="movie"
                  enrichmentKey={`movie:${m.id}`}
                  durationSec={m.metadata.durationSec}
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
              ))}
            </NetflixRail>
          )
        })}
    </div>
  )
}

/** Netflix-style Collections view */
export function CollectionsView() {
  const collections = useLibrary((s) => s.collections)
  const movies = useLibrary((s) => s.movies)
  const enrichment = useLibrary((s) => s.enrichment)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const moviesById = useMoviesByIdMap()
  const [query, setQuery] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = collections
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const ra = enrichment[`collection:${a.id}`]?.imdbRating || 0
      const rb = enrichment[`collection:${b.id}`]?.imdbRating || 0
      return rb - ra
    })
  }, [collections, query, enrichment])

  const heroItems = buildHeroItems(
    filtered.slice(0, 5),
    'collection',
    openDetail,
    playQueue,
    (c) => {
      const coll = collections.find((x) => x.id === c.id)
      return coll ? buildCollectionQueue(coll, moviesById) : []
    },
  )

  const hasMovies = movies.length > 0

  if (collections.length === 0) {
    return (
      <div className="pb-12">
        <div className="flex items-center justify-between mb-5 px-6 md:px-8">
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          {hasMovies && (
            <Button
              onClick={() => setManagerOpen(true)}
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-foreground)] font-semibold"
            >
              <Plus className="w-4 h-4" /> Create Collection
            </Button>
          )}
        </div>
        <CollectionsEmptyState
          onCreate={() => setManagerOpen(true)}
          hasMovies={hasMovies}
        />
        {managerOpen && (
          <CollectionManager
            key="new-collection"
            open={managerOpen}
            onOpenChange={setManagerOpen}
          />
        )}
      </div>
    )
  }

  return (
    <div className="pb-12">
      <NetflixHero items={heroItems} />
      <div className="px-6 md:px-8 mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search collections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        {hasMovies && (
          <Button
            onClick={() => setManagerOpen(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-foreground)] font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" /> New
          </Button>
        )}
      </div>
      <NetflixRail title={`Collections (${filtered.length})`}>
        {filtered.map((c) => (
          <NetflixCard
            key={c.id}
            title={c.title}
            year={c.year}
            coverUrl={c.coverUrl}
            kind="collection"
            enrichmentKey={`collection:${c.id}`}
            badge={`${c.movieIds.length} films`}
            onClick={() => openDetail({ kind: 'collection', id: c.id })}
            onPlay={() => playQueue(buildCollectionQueue(c, moviesById))}
          />
        ))}
      </NetflixRail>
      {managerOpen && (
        <CollectionManager
          key="new-collection"
          open={managerOpen}
          onOpenChange={setManagerOpen}
        />
      )}
    </div>
  )
}

/** Netflix-style TV Shows view */
export function TvView() {
  const tvShows = useLibrary((s) => s.tvShows)
  const enrichment = useLibrary((s) => s.enrichment)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)

  const enrichmentKeys = useMemo(
    () => tvShows.map((s) => `tv:${s.id}`),
    [tvShows],
  )
  const allGenres = useMemo(
    () => collectGenres(enrichment, enrichmentKeys),
    [enrichment, enrichmentKeys],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = tvShows
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q))
    if (genre) {
      list = list.filter((s) => {
        const e = enrichment[`tv:${s.id}`]
        return e?.genre?.includes(genre)
      })
    }
    return [...list].sort((a, b) => {
      const ra = enrichment[`tv:${a.id}`]?.imdbRating || 0
      const rb = enrichment[`tv:${b.id}`]?.imdbRating || 0
      return rb - ra
    })
  }, [tvShows, query, genre, enrichment])

  const top10 = useMemo(
    () =>
      [...tvShows]
        .sort((a, b) => {
          const ra = enrichment[`tv:${a.id}`]?.imdbRating || 0
          const rb = enrichment[`tv:${b.id}`]?.imdbRating || 0
          return rb - ra
        })
        .slice(0, 10),
    [tvShows, enrichment],
  )

  const heroItems = buildHeroItems(
    top10.slice(0, 5),
    'tv',
    openDetail,
    playQueue,
    (s) => {
      const show = tvShows.find((x) => x.id === s.id)
      return show ? buildShowQueue(show) : []
    },
  )

  if (tvShows.length === 0) {
    return (
      <EmptyView
        title="TV Shows"
        hint="No TV shows found. Files matching S01E05 or 1x05 patterns will be grouped here."
      />
    )
  }

  return (
    <div className="pb-12">
      <NetflixHero items={heroItems} />
      <div className="px-6 md:px-8 mb-6 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search TV shows…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>
      <div className="px-6 md:px-8">
        <GenreFilter genres={allGenres} selected={genre} onSelect={setGenre} />
      </div>

      {top10.length > 0 && !query && !genre && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-6 md:px-8">
            <Trophy className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-xl md:text-2xl font-bold">Top 10 Shows Today</h2>
          </div>
          <Top10Rail
            items={top10.map((s) => ({
              id: s.id,
              title: s.title,
              coverUrl: s.coverUrl,
              kind: 'tv',
              enrichmentKey: `tv:${s.id}`,
              onClick: () => openDetail({ kind: 'tv', id: s.id }),
              onPlay: () => playQueue(buildShowQueue(s)),
            }))}
          />
        </div>
      )}

      <NetflixRail title={query || genre ? `Results (${filtered.length})` : 'Popular Shows'}>
        {filtered.map((s) => (
          <NetflixCard
            key={s.id}
            title={s.title}
            year={s.year}
            coverUrl={s.coverUrl}
            kind="tv"
            enrichmentKey={`tv:${s.id}`}
            badge={`${s.totalEpisodes} eps`}
            onClick={() => openDetail({ kind: 'tv', id: s.id })}
            onPlay={() => playQueue(buildShowQueue(s))}
          />
        ))}
      </NetflixRail>

      {!query &&
        !genre &&
        allGenres.slice(0, 4).map((g) => {
          const inGenre = tvShows.filter((s) => {
            const e = enrichment[`tv:${s.id}`]
            return e?.genre?.includes(g)
          })
          if (inGenre.length === 0) return null
          return (
            <NetflixRail key={g} title={g}>
              {inGenre.slice(0, 15).map((s) => (
                <NetflixCard
                  key={s.id}
                  title={s.title}
                  year={s.year}
                  coverUrl={s.coverUrl}
                  kind="tv"
                  enrichmentKey={`tv:${s.id}`}
                  badge={`${s.totalEpisodes} eps`}
                  onClick={() => openDetail({ kind: 'tv', id: s.id })}
                  onPlay={() => playQueue(buildShowQueue(s))}
                />
              ))}
            </NetflixRail>
          )
        })}
    </div>
  )
}

/* =================================================================
 * SPOTIFY-STYLE VIEWS (Music, Podcasts)
 * ================================================================= */

/** Spotify-style Music view */
export function MusicView() {
  const albums = useLibrary((s) => s.albums)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const queue = useLibrary((s) => s.queue)
  const currentIndex = useLibrary((s) => s.currentIndex)
  const [query, setQuery] = useState('')

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
    return [...list].sort((a, b) => a.artist.localeCompare(b.artist))
  }, [albums, query])

  // Recently played (mock — first 6 albums)
  const recent = filtered.slice(0, 6)

  // Currently playing album id
  const currentPlayingAlbumId = queue[currentIndex]?.metadata.album
    ? albums.find(
        (a) =>
          a.title === queue[currentIndex]?.metadata.album &&
          a.artist === queue[currentIndex]?.metadata.artist,
      )?.id
    : undefined

  if (albums.length === 0) {
    return (
      <EmptyView
        title="Music"
        hint="No music albums found. MP3/FLAC/M4A files with embedded ID3 tags will be grouped by album."
      />
    )
  }

  // Quick-pick tiles (Spotify-style gradient tiles for first 6 artists)
  const artists = Array.from(
    new Set(albums.map((a) => a.artist)),
  ).slice(0, 6)

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="mb-6 px-6 md:px-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-700 flex items-center justify-center spotify-glow">
            <Music className="w-5 h-5 text-[var(--accent-foreground)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Music</h1>
            <p className="text-xs text-muted-foreground">
              {albums.length} albums · {albums.reduce((s, a) => s + a.tracks.length, 0)} tracks
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 md:px-8 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search albums and artists…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>

      {!query && (
        <>
          {/* Quick pick tiles (artist shortcuts) */}
          {artists.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 px-6 md:px-8 mb-8">
              {artists.map((artist, i) => {
                const artistAlbums = albums.filter((a) => a.artist === artist)
                const firstAlbum = artistAlbums[0]
                if (!firstAlbum) return null
                return (
                  <button
                    key={artist}
                    onClick={() => openDetail({ kind: 'album', id: firstAlbum.id })}
                    className="flex items-center gap-3 rounded-md overflow-hidden bg-white/[0.04] hover:bg-white/[0.1] transition group"
                  >
                    <div className="w-14 h-14 shrink-0 overflow-hidden">
                      <PosterArt
                        coverUrl={firstAlbum.coverUrl}
                        title={artist}
                        kind="album"
                        square
                      />
                    </div>
                    <span className="text-sm font-semibold truncate pr-3">{artist}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Good evening / Quick play row */}
          <SpotifyRail title="Good evening" subtitle="Jump back in">
            {recent.map((a) => (
              <div key={a.id} className="w-44 md:w-52 shrink-0">
                <SpotifyCard
                  title={a.title}
                  subtitle={a.artist}
                  coverUrl={a.coverUrl}
                  kind="album"
                  badge={`${a.tracks.length} tracks`}
                  onClick={() => openDetail({ kind: 'album', id: a.id })}
                  onPlay={() => playQueue(buildAlbumQueue(a))}
                  isPlaying={currentPlayingAlbumId === a.id}
                />
              </div>
            ))}
          </SpotifyRail>

          {/* All albums grid */}
          <SpotifyRail title="Your Albums" subtitle={`${filtered.length} albums in your library`}>
            {filtered.map((a) => (
              <div key={a.id} className="w-44 md:w-52 shrink-0">
                <SpotifyCard
                  title={a.title}
                  subtitle={a.artist}
                  coverUrl={a.coverUrl}
                  kind="album"
                  badge={a.year ? String(a.year) : undefined}
                  onClick={() => openDetail({ kind: 'album', id: a.id })}
                  onPlay={() => playQueue(buildAlbumQueue(a))}
                  isPlaying={currentPlayingAlbumId === a.id}
                />
              </div>
            ))}
          </SpotifyRail>
        </>
      )}

      {/* Search results */}
      {query && (
        <div className="px-6 md:px-8">
          <h2 className="text-lg font-bold mb-4">
            {filtered.length} result{filtered.length === 1 ? '' : 's'} for "{query}"
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((a) => (
              <SpotifyCard
                key={a.id}
                title={a.title}
                subtitle={a.artist}
                coverUrl={a.coverUrl}
                kind="album"
                onClick={() => openDetail({ kind: 'album', id: a.id })}
                onPlay={() => playQueue(buildAlbumQueue(a))}
                isPlaying={currentPlayingAlbumId === a.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Spotify-style Podcasts view */
export function PodcastsView() {
  const podcasts = useLibrary((s) => s.podcasts)
  const openDetail = useLibrary((s) => s.openDetail)
  const playQueue = useLibrary((s) => s.playQueue)
  const queue = useLibrary((s) => s.queue)
  const currentIndex = useLibrary((s) => s.currentIndex)
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

  const currentPlayingPodcastId = queue[currentIndex]?.metadata.showName
    ? podcasts.find((p) => p.title === queue[currentIndex]?.metadata.showName)?.id
    : undefined

  // Latest episodes across all podcasts (Spotify "Latest Episodes")
  // Computed before the early return so Hooks order is stable.
  const latestEpisodes = useMemo(() => {
    const eps: Array<{ podcastTitle: string; episodeTitle: string; durationSec?: number; onPlay: () => void }> = []
    for (const p of podcasts) {
      for (const ep of p.episodes.slice(-3).reverse()) {
        eps.push({
          podcastTitle: p.title,
          episodeTitle: ep.metadata.title || `Episode ${ep.episodeNumber}`,
          durationSec: ep.metadata.durationSec,
          onPlay: () => {
            const q = buildPodcastQueue(p, ep.id)
            playQueue(q, 0)
          },
        })
      }
    }
    return eps.slice(0, 12)
  }, [podcasts, playQueue])

  if (podcasts.length === 0) {
    return (
      <EmptyView
        title="Podcasts"
        hint="No podcasts detected. Long-form audio (25 min+) and files with 'podcast' or 'episode' in the name land here."
      />
    )
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="mb-6 px-6 md:px-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-700 flex items-center justify-center spotify-glow">
            <Mic className="w-5 h-5 text-[var(--accent-foreground)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Podcasts</h1>
            <p className="text-xs text-muted-foreground">
              {podcasts.length} shows · {podcasts.reduce((s, p) => s + p.episodes.length, 0)} episodes
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 md:px-8 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search podcasts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
      </div>

      {!query && (
        <>
          {/* Latest Episodes list (Spotify-style) */}
          {latestEpisodes.length > 0 && (
            <section className="mb-8 px-6 md:px-8">
              <div className="flex items-end justify-between mb-3">
                <h2 className="text-xl md:text-2xl font-bold">Latest Episodes</h2>
                <button className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:underline">
                  Show all
                </button>
              </div>
              <div className="space-y-1">
                {latestEpisodes.map((ep, i) => (
                  <button
                    key={i}
                    onClick={ep.onPlay}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.06] transition group text-left"
                  >
                    <div className="w-12 h-12 rounded bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
                      <PlayCircle className="w-6 h-6 text-[var(--accent)] group-hover:scale-110 transition" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{ep.episodeTitle}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ep.podcastTitle}
                      </div>
                    </div>
                    {ep.durationSec && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {Math.round(ep.durationSec / 60)} min
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Your Podcasts rail */}
          <SpotifyRail title="Your Podcasts">
            {filtered.map((p) => (
              <div key={p.id} className="w-44 md:w-52 shrink-0">
                <SpotifyCard
                  title={p.title}
                  subtitle={p.host}
                  coverUrl={p.coverUrl}
                  kind="podcast"
                  badge={`${p.episodes.length} eps`}
                  onClick={() => openDetail({ kind: 'podcast', id: p.id })}
                  onPlay={() => playQueue(buildPodcastQueue(p))}
                  isPlaying={currentPlayingPodcastId === p.id}
                />
              </div>
            ))}
          </SpotifyRail>
        </>
      )}

      {/* Search results */}
      {query && (
        <div className="px-6 md:px-8">
          <h2 className="text-lg font-bold mb-4">
            {filtered.length} result{filtered.length === 1 ? '' : 's'} for "{query}"
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((p) => (
              <SpotifyCard
                key={p.id}
                title={p.title}
                subtitle={p.host}
                coverUrl={p.coverUrl}
                kind="podcast"
                onClick={() => openDetail({ kind: 'podcast', id: p.id })}
                onPlay={() => playQueue(buildPodcastQueue(p))}
                isPlaying={currentPlayingPodcastId === p.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- Shared empty state ---------------- */
function EmptyView({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="pb-12">
      <h1 className="text-2xl font-bold tracking-tight mb-5">{title}</h1>
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
        <Clock className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{hint}</p>
      </div>
    </div>
  )
}
