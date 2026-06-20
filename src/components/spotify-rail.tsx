'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpotifyRailProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Spotify-style horizontal rail. Similar to NetflixRail but with the
 * Spotify aesthetic: slightly different arrow style, show-all link.
 */
export function SpotifyRail({ title, subtitle, children }: SpotifyRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({
      left: dir === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8,
      behavior: 'smooth',
    })
  }

  return (
    <section className="group/rail mb-8">
      <div className="flex items-end justify-between mb-3 px-6 md:px-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight hover:underline cursor-pointer">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <button className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:underline">
          Show all
        </button>
      </div>
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center',
            'bg-gradient-to-r from-background/90 to-transparent',
            'transition-opacity duration-200',
            canLeft ? 'opacity-0 group-hover/rail:opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-label="Scroll left"
        >
          <div className="w-10 h-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center hover:bg-black/90 transition">
            <ChevronLeft className="w-5 h-5" />
          </div>
        </button>
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="rail-scroll flex gap-2 md:gap-4 overflow-x-auto px-6 md:px-8 pb-2"
        >
          {children}
        </div>
        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center',
            'bg-gradient-to-l from-background/90 to-transparent',
            'transition-opacity duration-200',
            canRight ? 'opacity-0 group-hover/rail:opacity-100' : 'opacity-0 pointer-events-none',
          )}
          aria-label="Scroll right"
        >
          <div className="w-10 h-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center hover:bg-black/90 transition">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>
    </section>
  )
}
