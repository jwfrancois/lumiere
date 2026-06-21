'use client'

import { Play, Star } from 'lucide-react'
import { useLibrary, type EnrichedInfo } from '@/store/library'
import { PosterArt } from './poster-art'
import { cn } from '@/lib/utils'

interface Top10Item {
  id: string
  title: string
  coverUrl?: string
  kind: 'movie' | 'tv' | 'collection'
  enrichmentKey: string
  onClick?: () => void
  onPlay?: () => void
}

/**
 * Netflix-style Top 10 rail with huge oversized numbers next to each poster.
 *
 * Enhancements:
 *  - Rating badge visible on each poster
 *  - Click-to-play directly from the number
 */
export function Top10Rail({ items }: { items: Top10Item[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex gap-1 overflow-x-auto rail-scroll px-6 md:px-8 pb-4">
      {items.slice(0, 10).map((item, i) => (
        <Top10Card key={item.id} item={item} rank={i + 1} />
      ))}
    </div>
  )
}

function Top10Card({ item, rank }: { item: Top10Item; rank: number }) {
  const enrichment = useLibrary((s) => s.enrichment[item.enrichmentKey]) as
    | EnrichedInfo
    | undefined
  const posterUrl = item.coverUrl || enrichment?.posterUrl
  const rating = enrichment?.imdbRating

  return (
    <div
      className="relative flex items-end shrink-0 cursor-pointer group"
      onClick={item.onClick}
    >
      {/* Huge number */}
      <span
        className={cn(
          'top10-number leading-none -mr-4 md:-mr-6 select-none',
          rank === 10 ? 'ml-2' : '',
        )}
        style={{ minWidth: rank === 10 ? '1.4em' : '0.8em' }}
      >
        {rank}
      </span>
      {/* Poster */}
      <div className="relative w-28 md:w-36 aspect-[2/3] rounded-md overflow-hidden bg-card shadow-xl group-hover:scale-105 transition-transform">
        <PosterArt coverUrl={posterUrl} title={item.title} kind={item.kind} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        {rating !== undefined && (
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 backdrop-blur text-amber-300">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
          </div>
        )}
        {/* Hover play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation()
              item.onPlay?.()
            }}
            className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl hover:scale-110 transition"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2">
          <h3 className="text-[11px] font-semibold text-white line-clamp-1 drop-shadow">
            {item.title}
          </h3>
        </div>
      </div>
    </div>
  )
}
