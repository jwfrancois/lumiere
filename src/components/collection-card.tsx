'use client'

import { useLibrary, type EnrichedInfo } from '@/store/library'
import { PosterArt } from './poster-art'
import { Star, Layers, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollectionCardProps {
  title: string
  year?: number
  coverUrl?: string
  enrichmentKey: string
  movieIds: string[]
  movies: Array<{
    id: string
    title: string
    coverUrl?: string
    year?: number
    metadata: { durationSec?: number }
  }>
  onClick?: () => void
  onPlay?: () => void
}

/**
 * Netflix/MediaHub-style collection card with a fanned stack of movie
 * posters peeking out behind a large featured poster.
 *
 * Visual structure:
 *  - Large featured poster (first movie in the collection)
 *  - Up to 3 smaller posters offset to the right, fanned behind it
 *  - Film count badge in the top-right corner
 *  - Title + synopsis below the poster stack
 *  - Landscape card (wider than tall)
 */
export function CollectionCard({
  title,
  year,
  coverUrl,
  enrichmentKey,
  movieIds,
  movies,
  onClick,
  onPlay,
}: CollectionCardProps) {
  const enrichment = useLibrary((s) => s.enrichment[enrichmentKey]) as
    | EnrichedInfo
    | undefined

  const featuredCover = coverUrl || enrichment?.posterUrl || movies[0]?.coverUrl
  // Up to 3 "behind" posters, offset to the right
  const behindPosters = movies.slice(1, 4)

  return (
    <div
      className="group cursor-pointer w-72 md:w-80 shrink-0"
      onClick={onClick}
    >
      {/* Poster stack — landscape container */}
      <div className="relative h-44 md:h-48 mb-3 overflow-visible">
        {/* Behind posters — fanned to the right, peeking out */}
        {behindPosters.map((m, i) => {
          // Each behind poster is offset to the right and slightly down,
          // peeks out from behind the featured poster
          const xOffset = 80 + i * 28 // px offset to the right
          const yOffset = (i + 1) * 4 // slight downward stagger
          const scale = 0.85 - i * 0.05
          const rotate = (i + 1) * 2 // slight rotation for fanned look
          return (
            <div
              key={m.id}
              className="absolute top-0 left-0 transition-all duration-300 group-hover:translate-x-1"
              style={{
                transform: `translateX(${xOffset}px) translateY(${yOffset}px) scale(${scale}) rotate(${rotate}deg)`,
                transformOrigin: 'top left',
                zIndex: 5 - i,
                opacity: 0.7 - i * 0.15,
              }}
            >
              <div className="w-40 md:w-44 aspect-[2/3] rounded-md overflow-hidden shadow-xl border border-black/40">
                <PosterArt coverUrl={m.coverUrl} title={m.title} kind="movie" />
              </div>
            </div>
          )
        })}

        {/* Featured (large) poster — on top, left-aligned */}
        <div className="relative z-10 w-40 md:w-44 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-white/10 transition-transform duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1">
          <PosterArt coverUrl={featuredCover} title={title} kind="collection" />

          {/* Top gradient for badge legibility */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Film count badge — top-right */}
          <div className="absolute top-2 right-2 z-20 px-2 py-1 rounded-md text-[10px] font-bold bg-black/80 backdrop-blur text-white border border-white/20 flex items-center gap-1">
            <Layers className="w-3 h-3 text-[var(--accent)]" />
            {movieIds.length} films
          </div>

          {/* Rating badge — top-left */}
          {enrichment?.imdbRating !== undefined && (
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-black/80 backdrop-blur text-amber-300 border border-amber-500/30">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {enrichment.imdbRating.toFixed(1)}
            </div>
          )}

          {/* Hover play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay?.()
              }}
              className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
              aria-label={`Play ${title}`}
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Text below */}
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-[var(--accent)] transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {year && <span>{year}</span>}
          {enrichment?.genre && (
            <span className="text-[var(--accent)]/80 line-clamp-1">{enrichment.genre}</span>
          )}
        </div>
        {enrichment?.plot && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {enrichment.plot}
          </p>
        )}
      </div>
    </div>
  )
}
