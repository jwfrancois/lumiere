'use client'

import { Play, Pause } from 'lucide-react'
import { useLibrary, type EnrichedInfo } from '@/store/library'
import { PosterArt } from './poster-art'
import { cn } from '@/lib/utils'

interface SpotifyCardProps {
  title: string
  subtitle?: string
  coverUrl?: string
  kind: 'album' | 'podcast'
  enrichmentKey?: string
  badge?: string
  onClick?: () => void
  onPlay?: () => void
  isPlaying?: boolean
}

/**
 * Spotify-style card with rounded square art, hover-play button that
 * slides up, and a subtle background tint on hover.
 *
 * Enhancements beyond Spotify:
 *  - "Now playing" indicator with animated equalizer bars when isPlaying
 *  - Genre/badge support
 *  - Subtitle supports artist (album) or host (podcast)
 */
export function SpotifyCard({
  title,
  subtitle,
  coverUrl,
  kind,
  enrichmentKey,
  badge,
  onClick,
  onPlay,
  isPlaying,
}: SpotifyCardProps) {
  const enrichment = useLibrary((s) =>
    enrichmentKey ? s.enrichment[enrichmentKey] : undefined,
  ) as EnrichedInfo | undefined
  // Prefer embedded cover, then fetched hi-res artwork, then fetched standard artwork
  const cover =
    coverUrl ||
    enrichment?.artworkUrlHiRes ||
    enrichment?.artworkUrl ||
    enrichment?.posterUrl

  return (
    <div
      onClick={onClick}
      className="spotify-card group cursor-pointer rounded-lg p-3 md:p-4 bg-white/[0.03] hover:bg-white/[0.08] transition"
    >
      <div className="relative aspect-square mb-3 rounded-md overflow-hidden shadow-lg">
        <div className="spotify-card-image w-full h-full">
          <PosterArt coverUrl={cover} title={title} kind={kind} square />
        </div>

        {/* Badge */}
        {badge && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-black/70 backdrop-blur text-[var(--accent)]">
            {badge}
          </div>
        )}

        {/* Now-playing equalizer */}
        {isPlaying && (
          <div className="absolute top-2 right-2 z-10 px-1.5 py-1 rounded bg-black/70 backdrop-blur flex items-end gap-[2px] h-5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[3px] bg-[var(--accent)] rounded-full eq-bar"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {/* Hover play button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
          className="spotify-card-play absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center shadow-2xl hover:scale-110 transition spotify-glow"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>
      </div>

      <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
      )}
      {enrichment?.genre && !badge && (
        <p className="text-[10px] text-[var(--accent)]/70 truncate mt-0.5">{enrichment.genre}</p>
      )}
    </div>
  )
}
