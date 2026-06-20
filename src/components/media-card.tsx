'use client'

import { Play, Info, Star, Clock, Loader2 } from 'lucide-react'
import { PosterArt } from './poster-art'
import { formatDuration } from '@/lib/metadata'
import { cn } from '@/lib/utils'
import { useLibrary } from '@/store/library'

export interface CardEnrichment {
  posterUrl?: string
  imdbRating?: number
  rottenTomatoes?: number
  metacritic?: number
  plot?: string
  genre?: string
  runtime?: string
  rated?: string
}

interface MediaCardProps {
  title: string
  subtitle?: string
  coverUrl?: string
  year?: number
  durationSec?: number
  rating?: number
  badge?: string
  kind: 'movie' | 'tv' | 'album' | 'podcast' | 'collection'
  aspect?: 'portrait' | 'square'
  /**
   * Enrichment key — when provided, the card will look up its own
   * enrichment from the global store and reflect "enriching" status.
   * e.g. `movie:<id>`, `tv:<id>`, `collection:<id>`.
   * Omit for albums / podcasts (no enrichment).
   */
  enrichmentKey?: string
  /** Initial enrichment (used for tests). */
  initialEnrichment?: CardEnrichment
  onClick?: () => void
  onPlay?: () => void
}

export function MediaCard({
  title,
  subtitle,
  coverUrl,
  year,
  durationSec,
  rating,
  badge,
  kind,
  aspect = 'portrait',
  enrichmentKey,
  initialEnrichment,
  onClick,
  onPlay,
}: MediaCardProps) {
  const aspectClass =
    aspect === 'portrait' ? 'aspect-[2/3]' : 'aspect-square'

  // Look up enrichment + enriching status from the global store.
  // When no key is provided (albums/podcasts), both are no-ops.
  const enrichment = useLibrary((s) =>
    enrichmentKey ? s.enrichment[enrichmentKey] : undefined,
  ) as CardEnrichment | undefined
  const enriching = useLibrary((s) =>
    enrichmentKey ? s.enriching.has(enrichmentKey) : false,
  )

  // Prefer embedded cover, then enriched poster, then gradient placeholder.
  const effectiveEnrichment = enrichment || initialEnrichment
  const posterUrl = coverUrl || effectiveEnrichment?.posterUrl
  // For rating, prefer explicit prop, then enrichment IMDb.
  const effectiveRating = rating ?? effectiveEnrichment?.imdbRating
  const rtScore = effectiveEnrichment?.rottenTomatoes

  return (
    <div className="group relative cursor-pointer" onClick={onClick}>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl bg-card border border-border/40 transition-all duration-300 poster-glow',
          'group-hover:border-amber-500/40 group-hover:shadow-xl group-hover:shadow-amber-500/10 group-hover:-translate-y-1',
          aspectClass,
        )}
      >
        <PosterArt coverUrl={posterUrl} title={title} kind={kind} />

        {/* Top-left badge (e.g. "3 films", "4 tracks") */}
        {badge && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-black/70 backdrop-blur text-amber-300 border border-amber-500/30">
            {badge}
          </div>
        )}

        {/* Top-right rating (IMDb) */}
        {effectiveRating !== undefined && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 backdrop-blur text-amber-300 border border-amber-500/20">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {effectiveRating.toFixed(1)}
          </div>
        )}

        {/* "Enriching" pulse — small spinner in top-right while fetching */}
        {!effectiveRating && enriching && (
          <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-md text-[10px] bg-black/70 backdrop-blur text-muted-foreground flex items-center gap-1 border border-white/10">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlay?.()
            }}
            className="w-14 h-14 rounded-full bg-amber-500/95 hover:bg-amber-400 text-black flex items-center justify-center shadow-2xl shadow-amber-500/30 hover:scale-110 transition-transform"
            aria-label={`Play ${title}`}
          >
            <Play className="w-6 h-6 ml-0.5 fill-current" />
          </button>
        </div>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3 z-10">
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/60 tabular-nums">
            {year && <span>{year}</span>}
            {effectiveEnrichment?.rated && effectiveEnrichment.rated !== 'N/A' && (
              <span className="px-1 py-0 rounded border border-white/30 text-[9px] uppercase">
                {effectiveEnrichment.rated}
              </span>
            )}
            {durationSec !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(durationSec)}
              </span>
            )}
          </div>
          {effectiveEnrichment?.genre && (
            <p className="mt-0.5 text-[10px] text-amber-300/70 line-clamp-1">
              {effectiveEnrichment.genre}
            </p>
          )}
          {subtitle && !effectiveEnrichment?.genre && (
            <p className="mt-0.5 text-[11px] text-amber-300/80 line-clamp-1">
              {subtitle}
            </p>
          )}
          {rtScore !== undefined && (
            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600/80 text-white text-[9px] font-bold">
              RT {rtScore}%
            </div>
          )}
        </div>
      </div>

      {/* Info button under card */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        className="hidden group-hover:flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground hover:text-amber-300 transition-colors focus-ring rounded px-1 py-0.5"
      >
        <Info className="w-3 h-3" /> Details
      </button>
    </div>
  )
}
