'use client'

import { useState, useEffect } from 'react'
import { useLibrary } from '@/store/library'
import { User, Film, Tv, ChevronRight, Loader2 } from 'lucide-react'
import { PosterArt } from './poster-art'
import { cn } from '@/lib/utils'
import type { CastInfo } from '@/app/api/cast/route'

/**
 * Roon/IMDb-style cast browser with photos and filmography.
 *
 * Shows cast members with their photos (fetched from Wikipedia) and
 * cross-references each actor against your library to show other movies
 * and TV shows they appear in.
 *
 * Features:
 *  - Actor photo (circular, from Wikipedia)
 *  - Actor name + role description
 *  - Bio (expandable)
 *  - Filmography: other movies/shows in your library with same actor
 *  - Click any filmography item to open its detail
 */

interface CastBrowserProps {
  /** Comma-separated cast string from OMDB enrichment. */
  castString?: string
  /** Current item id (to exclude from filmography). */
  currentItemId: string
  /** Whether this is a movie or TV show (affects filmography search). */
  context: 'movie' | 'tv'
}

interface CastMember extends CastInfo {
  loading: boolean
  filmography: Array<{
    id: string
    title: string
    coverUrl?: string
    year?: number
    kind: 'movie' | 'tv'
  }>
}

export function CastBrowser({ castString, currentItemId, context }: CastBrowserProps) {
  const movies = useLibrary((s) => s.movies)
  const tvShows = useLibrary((s) => s.tvShows)
  const enrichment = useLibrary((s) => s.enrichment)
  const openDetail = useLibrary((s) => s.openDetail)
  const [expandedActor, setExpandedActor] = useState<string | null>(null)

  // Parse cast string into names
  const castNames = castString
    ? castString
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && n !== 'N/A')
        .slice(0, 12) // limit to top 12
    : []

  // State for fetched cast data — initialized with loading entries for each name
  const [castData, setCastData] = useState<Map<string, CastMember>>(() => {
    const initial = new Map<string, CastMember>()
    for (const name of castNames) {
      initial.set(name, {
        name,
        source: 'wikipedia',
        found: false,
        loading: true,
        filmography: [],
      })
    }
    return initial
  })

  // Fetch cast photos on mount / when cast changes
  useEffect(() => {
    if (castNames.length === 0) return
    let cancelled = false

    // Fetch each actor's data (rate-limited)
    const fetchAll = async () => {
      for (const name of castNames) {
        if (cancelled) return
        try {
          const res = await fetch(`/api/cast?name=${encodeURIComponent(name)}`, {
            cache: 'no-store',
          })
          if (!res.ok) continue
          const data = (await res.json()) as CastInfo
          if (cancelled) return

          // Compute filmography: find other movies/shows in library
          // that have this actor in their cast
          const filmography: CastMember['filmography'] = []

          // Search movies
          for (const m of movies) {
            if (m.id === currentItemId) continue
            const mEnrich = enrichment[`movie:${m.id}`]
            if (mEnrich?.cast) {
              const castLower = mEnrich.cast.toLowerCase()
              if (castLower.includes(name.toLowerCase())) {
                filmography.push({
                  id: m.id,
                  title: m.title,
                  coverUrl: m.coverUrl || mEnrich.posterUrl,
                  year: m.year,
                  kind: 'movie',
                })
              }
            }
          }

          // Search TV shows
          for (const s of tvShows) {
            const sKey = `tv:${s.id}`
            const sEnrich = enrichment[sKey]
            if (sEnrich?.cast) {
              const castLower = sEnrich.cast.toLowerCase()
              if (castLower.includes(name.toLowerCase())) {
                filmography.push({
                  id: s.id,
                  title: s.title,
                  coverUrl: s.coverUrl || sEnrich.posterUrl,
                  year: s.year,
                  kind: 'tv',
                })
              }
            }
          }

          // Also search collections
          // (skip — collections are groups of movies already searched)

          setCastData((prev) => {
            const next = new Map(prev)
            next.set(name, {
              ...data,
              loading: false,
              filmography,
            })
            return next
          })
        } catch {
          setCastData((prev) => {
            const next = new Map(prev)
            next.set(name, {
              name,
              source: 'wikipedia',
              found: false,
              loading: false,
              filmography: [],
            })
            return next
          })
        }
        // Small delay between requests
        await new Promise((r) => setTimeout(r, 150))
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [castString, currentItemId])

  if (castNames.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2 text-amber-300/90">Cast</h4>
        <p className="text-xs text-muted-foreground">
          Cast information not available for this title.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 text-amber-300/90 flex items-center gap-2">
        <User className="w-4 h-4" />
        Cast
      </h4>
      <div className="space-y-2">
        {castNames.map((name) => {
          const member = castData.get(name)
          if (!member) return null
          return (
            <CastRow
              key={name}
              member={member}
              expanded={expandedActor === name}
              onToggle={() =>
                setExpandedActor(expandedActor === name ? null : name)
              }
              onItemClick={(id, kind) =>
                openDetail({ kind: kind === 'movie' ? 'movie' : 'tv', id })
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function CastRow({
  member,
  expanded,
  onToggle,
  onItemClick,
}: {
  member: CastMember
  expanded: boolean
  onToggle: () => void
  onItemClick: (id: string, kind: 'movie' | 'tv') => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border transition',
        expanded
          ? 'bg-muted/40 border-border/60'
          : 'bg-muted/20 border-border/40 hover:bg-muted/30',
      )}
    >
      {/* Actor header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-2.5 text-left"
      >
        {/* Photo */}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted shrink-0 border border-white/10">
          {member.loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-rose-500/20">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{member.name}</div>
          {member.description && (
            <div className="text-xs text-muted-foreground truncate">
              {member.description}
            </div>
          )}
        </div>

        {/* Filmography count badge */}
        {member.filmography.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
            {member.filmography.length} in library
          </span>
        )}

        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform shrink-0',
            expanded && 'rotate-90',
          )}
        />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* Bio */}
          {member.bio && (
            <p className="text-xs text-muted-foreground leading-relaxed px-1 pt-1">
              {member.bio}
            </p>
          )}

          {/* Filmography */}
          {member.filmography.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 mb-1.5">
                Also in your library
              </div>
              <div className="space-y-1">
                {member.filmography.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() => onItemClick(item.id, item.kind)}
                    className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/[0.06] transition text-left group"
                  >
                    <div className="w-10 h-14 rounded overflow-hidden bg-muted shrink-0">
                      <PosterArt
                        coverUrl={item.coverUrl}
                        title={item.title}
                        kind={item.kind === 'movie' ? 'movie' : 'tv'}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate group-hover:text-amber-300 transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        {item.kind === 'tv' ? (
                          <Tv className="w-3 h-3" />
                        ) : (
                          <Film className="w-3 h-3" />
                        )}
                        {item.year && <span>{item.year}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!member.bio && member.filmography.length === 0 && !member.loading && (
            <p className="text-xs text-muted-foreground/60 px-1">
              No additional information available.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
