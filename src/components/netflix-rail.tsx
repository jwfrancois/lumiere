'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NetflixRailProps {
  title: string
  /** Optional small badge text, e.g. "Top 10" */
  badge?: string
  children: ReactNode
  /** If true, uses extra-large cards (for Top 10 numbered list). */
  large?: boolean
}

/**
 * Netflix-style horizontal rail with hover-reveal arrow navigation.
 *
 * Enhancements beyond Netflix:
 *  - Arrows fade in on hover (less visual clutter)
 *  - Smooth scroll with momentum
 *  - Title + optional badge
 *  - Hides arrows at scroll boundaries
 */
export function NetflixRail({ title, badge, children, large }: NetflixRailProps) {
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
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className="group/rail mb-8">
      <div className="flex items-center gap-2 mb-3 px-6 md:px-8">
        <h2 className="text-lg md:text-xl font-bold tracking-tight">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-[var(--accent-foreground)]">
            {badge}
          </span>
        )}
      </div>
      <div className="relative">
        {/* Left arrow */}
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
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition">
            <ChevronLeft className="w-6 h-6" />
          </div>
        </button>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="rail-scroll flex gap-2 md:gap-3 overflow-x-auto px-6 md:px-8 pb-4"
        >
          {children}
        </div>

        {/* Right arrow */}
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
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition">
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>
      </div>
      {void large}
    </section>
  )
}
