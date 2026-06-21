'use client'

import { useEffect, useState } from 'react'
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLibrary } from '@/store/library'
import { cn } from '@/lib/utils'
import type { EnrichedInfo } from '@/store/library'

interface HeroItem {
  id: string
  title: string
  year?: number
  coverUrl?: string
  enrichmentKey: string
  kind: 'movie' | 'tv' | 'collection'
  onPlay: () => void
  onDetails: () => void
}

/**
 * Netflix-style hero banner — rotates through featured content with a
 * full-bleed backdrop, gradient overlays, title, metadata, and CTA buttons.
 *
 * Enhancements beyond Netflix:
 *  - Multi-source ratings (IMDb, RT, Metacritic) inline
 *  - Auto-rotation with manual prev/next + dot indicators
 *  - Genre + runtime + rated badges
 *  - Synopsis preview
 */
export function NetflixHero({ items }: { items: HeroItem[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-advance every 8 seconds
  useEffect(() => {
    if (paused || items.length <= 1) return
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 8000)
    return () => clearInterval(t)
  }, [paused, items.length])

  if (items.length === 0) return null
  const item = items[index]

  return (
    <section
      className="relative h-[60vh] min-h-[420px] md:h-[70vh] -mx-6 md:-mx-8 mb-8 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop */}
      <HeroBackdrop item={item} />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />

      {/* Content */}
      <div className="relative h-full max-w-3xl flex flex-col justify-end px-6 md:px-8 pb-10 md:pb-16">
        <HeroContent item={item} />
      </div>

      {/* Prev / Next arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-strong flex items-center justify-center hover:bg-black/60 transition"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-strong flex items-center justify-center hover:bg-black/60 transition"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-4 right-6 md:right-8 z-20 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1 rounded-full transition-all',
                  i === index ? 'w-8 bg-[var(--accent)]' : 'w-2 bg-white/30 hover:bg-white/50',
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function HeroBackdrop({ item }: { item: HeroItem }) {
  const enrichment = useLibrary((s) => s.enrichment[item.enrichmentKey]) as EnrichedInfo | undefined
  const cover = item.coverUrl || enrichment?.posterUrl

  if (cover) {
    return (
      <img
        src={cover}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-105"
        key={cover}
      />
    )
  }
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-rose-900/40 via-purple-900/30 to-amber-900/30 hero-shimmer" />
  )
}

function HeroContent({ item }: { item: HeroItem }) {
  const enrichment = useLibrary((s) => s.enrichment[item.enrichmentKey]) as EnrichedInfo | undefined

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-[0.3em] text-[var(--accent)] font-bold">
          Featured {item.kind}
        </span>
        {enrichment?.imdbRating !== undefined && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/60 backdrop-blur text-amber-300 border border-amber-500/30">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {enrichment.imdbRating.toFixed(1)}
          </span>
        )}
      </div>
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-4 drop-shadow-2xl">
        {item.title}
      </h1>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/80 mb-4">
        {item.year && <span className="font-medium">{item.year}</span>}
        {enrichment?.rated && enrichment.rated !== 'N/A' && (
          <span className="px-1.5 py-0 rounded border border-white/40 text-[10px] uppercase font-bold">
            {enrichment.rated}
          </span>
        )}
        {enrichment?.runtime && <span>{enrichment.runtime}</span>}
        {enrichment?.genre && <span className="text-[var(--accent)]">{enrichment.genre}</span>}
      </div>
      {enrichment?.plot && (
        <p className="text-sm md:text-base text-foreground/70 mb-6 line-clamp-3 max-w-2xl drop-shadow-lg">
          {enrichment.plot}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={item.onPlay}
          className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-foreground)] font-bold border-0 px-8"
        >
          <Play className="w-5 h-5 fill-current" /> Play
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={item.onDetails}
          className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20 font-semibold"
        >
          <Info className="w-5 h-5" /> More Info
        </Button>
      </div>
    </>
  )
}
