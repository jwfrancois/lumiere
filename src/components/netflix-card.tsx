'use client'

import { Play, Info, Star, Plus, ThumbsUp, ChevronDown } from 'lucide-react'
import { useLibrary, type EnrichedInfo } from '@/store/library'
import { PosterArt } from './poster-art'
import { formatDuration } from '@/lib/metadata'
import { cn } from '@/lib/utils'

interface NetflixCardProps {
  title: string
  year?: number
  coverUrl?: string
  kind: 'movie' | 'tv' | 'collection'
  enrichmentKey: string
  badge?: string
  durationSec?: number
  onClick?: () => void
  onPlay?: () => void
  onQueue?: () => void
}

/**
 * Netflix-style poster card with dramatic hover preview.
 *
 * Enhancements beyond Netflix:
 *  - Card scales up on hover and reveals a preview panel with metadata,
 *    ratings, and quick actions (Play, Queue, Like, More Info)
 *  - Multi-source ratings visible (IMDb star + RT score)
 *  - Genre + runtime + rated badges
 *  - "Add to Queue" quick action
 */
export function NetflixCard({
  title,
  year,
  coverUrl,
  kind,
  enrichmentKey,
  badge,
  durationSec,
  onClick,
  onPlay,
  onQueue,
}: NetflixCardProps) {
  const enrichment = useLibrary((s) => s.enrichment[enrichmentKey]) as
    | EnrichedInfo
    | undefined

  const posterUrl = coverUrl || enrichment?.posterUrl
  const rating = enrichment?.imdbRating
  const rtScore = enrichment?.rottenTomatoes

  return (
    <div className="netflix-card relative w-36 md:w-44 shrink-0 cursor-pointer">
      <div
        className="relative rounded-md overflow-hidden bg-card border-0 shadow-lg"
        onClick={onClick}
      >
        <div className="aspect-[2/3] relative">
          <PosterArt coverUrl={posterUrl} title={title} kind={kind} />

          {/* Badge */}
          {badge && (
            <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--accent)] text-[var(--accent-foreground)]">
              {badge}
            </div>
          )}

          {/* Rating */}
          {rating !== undefined && (
            <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 backdrop-blur text-amber-300">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </div>
          )}

          {/* Bottom gradient + title (always visible) */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-2">
            <h3 className="text-xs font-semibold text-white line-clamp-2 leading-tight drop-shadow">
              {title}
            </h3>
          </div>
        </div>
      </div>

      {/* Hover preview panel — appears below the scaled card */}
      <div className="netflix-card-preview absolute left-0 right-0 top-full -mt-2 z-40 rounded-b-md overflow-hidden bg-card border border-border/60 shadow-2xl">
        <div className="p-3 space-y-2">
          {/* Quick actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay?.()
              }}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/80 transition"
              aria-label="Play"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onQueue?.()
              }}
              className="w-8 h-8 rounded-full border border-white/30 text-white flex items-center justify-center hover:border-white transition"
              aria-label="Add to queue"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 rounded-full border border-white/30 text-white flex items-center justify-center hover:border-white transition"
              aria-label="Like"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick?.()
              }}
              className="ml-auto w-8 h-8 rounded-full border border-white/30 text-white flex items-center justify-center hover:border-white transition"
              aria-label="More info"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-[11px] text-foreground/70">
            {year && <span className="font-medium text-foreground/90">{year}</span>}
            {enrichment?.rated && enrichment.rated !== 'N/A' && (
              <span className="px-1 py-0 rounded border border-white/30 text-[9px] uppercase">
                {enrichment.rated}
              </span>
            )}
            {durationSec !== undefined && (
              <span className="flex items-center gap-0.5">
                {formatDuration(durationSec)}
              </span>
            )}
            {rtScore !== undefined && (
              <span className="ml-auto px-1.5 py-0.5 rounded bg-rose-600/80 text-white text-[9px] font-bold">
                RT {rtScore}%
              </span>
            )}
          </div>

          {/* Genre */}
          {enrichment?.genre && (
            <p className="text-[10px] text-[var(--accent)] line-clamp-1 font-medium">
              {enrichment.genre}
            </p>
          )}

          {/* Plot snippet */}
          {enrichment?.plot && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
              {enrichment.plot}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
