'use client'

import { useState, useMemo } from 'react'
import { useLibrary } from '@/store/library'
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Roon-style Focus filter.
 *
 * Multi-dimensional filtering for the music library. Users can combine:
 *  - Artist (multi-select)
 *  - Genre (multi-select)
 *  - Decade (multi-select: 60s, 70s, 80s, 90s, 00s, 10s, 20s)
 *  - Tag (user-defined tags)
 *  - Play count (never played, played 1-5x, played 5+x)
 *
 * All filters combine with AND logic. A live count shows how many albums
 * match the current focus.
 */

interface FocusFilterProps {
  albumIds: string[]
  onFilteredChange: (filteredIds: string[]) => void
}

type FilterKey = 'artist' | 'genre' | 'decade' | 'tag' | 'playCount'

interface FilterState {
  artists: Set<string>
  genres: Set<string>
  decades: Set<string>
  tags: Set<string>
  playCounts: Set<string> // 'never', '1-5', '5+'
}

export function FocusFilter({ albumIds, onFilteredChange }: FocusFilterProps) {
  const albums = useLibrary((s) => s.albums)
  const tagState = useLibrary((s) => s.tagState)
  const listeningHistory = useLibrary((s) => s.listeningHistory)
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    artists: new Set(),
    genres: new Set(),
    decades: new Set(),
    tags: new Set(),
    playCounts: new Set(),
  })

  // Build available filter options from the library
  const options = useMemo(() => {
    const artists = new Set<string>()
    const genres = new Set<string>()
    const decades = new Set<string>()
    for (const a of albums) {
      if (albumIds.includes(a.id)) {
        artists.add(a.artist)
        if (a.genre) {
          for (const g of a.genre.split(',')) {
            const t = g.trim()
            if (t && t !== 'N/A') genres.add(t)
          }
        }
        if (a.year) {
          const decade = Math.floor(a.year / 10) * 10
          decades.add(`${decade}s`)
        }
      }
    }
    const tags = Object.keys(tagState.tags).sort()
    return {
      artists: Array.from(artists).sort(),
      genres: Array.from(genres).sort(),
      decades: Array.from(decades).sort(),
      tags,
    }
  }, [albums, albumIds, tagState])

  // Apply filters
  const filteredIds = useMemo(() => {
    const result: string[] = []
    for (const a of albums) {
      if (!albumIds.includes(a.id)) continue
      if (filters.artists.size > 0 && !filters.artists.has(a.artist)) continue
      if (filters.genres.size > 0) {
        const albumGenres = (a.genre || '')
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean)
        const hasGenre = albumGenres.some((g) => filters.genres.has(g))
        if (!hasGenre) continue
      }
      if (filters.decades.size > 0 && a.year) {
        const decade = `${Math.floor(a.year / 10) * 10}s`
        if (!filters.decades.has(decade)) continue
      }
      if (filters.tags.size > 0) {
        const albumTags = tagState.itemTags[a.id] || []
        const hasTag = filters.tags.some((t) => albumTags.includes(t))
        if (!hasTag) continue
      }
      if (filters.playCounts.size > 0) {
        // Check if any track in the album has been played
        const trackPlayCounts = a.tracks.map(
          (t) => listeningHistory.tracks[t.id]?.playCount || 0,
        )
        const maxPlays = Math.max(...trackPlayCounts, 0)
        const matches = (
          filters.playCounts.has('never') && maxPlays === 0) ||
          (filters.playCounts.has('1-5') && maxPlays >= 1 && maxPlays <= 5) ||
          (filters.playCounts.has('5+') && maxPlays > 5)
        if (!matches) continue
      }
      result.push(a.id)
    }
    return result
  }, [albums, albumIds, filters, tagState, listeningHistory])

  // Notify parent of filtered results
  useMemo(() => {
    onFilteredChange(filteredIds)
  }, [filteredIds, onFilteredChange])

  const toggle = (key: FilterKey, value: string) => {
    setFilters((s) => {
      const set = new Set(s[key as keyof FilterState] as Set<string>)
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...s, [key]: set }
    })
  }

  const activeCount =
    filters.artists.size +
    filters.genres.size +
    filters.decades.size +
    filters.tags.size +
    filters.playCounts.size

  const clearAll = () => {
    setFilters({
      artists: new Set(),
      genres: new Set(),
      decades: new Set(),
      tags: new Set(),
      playCounts: new Set(),
    })
  }

  return (
    <div className="rounded-xl bg-card/40 border border-border/40 mb-4">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-3"
      >
        <Filter className="w-4 h-4 text-[var(--accent)]" />
        <span className="text-sm font-semibold">Focus</span>
        {activeCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[var(--accent-foreground)]">
            {activeCount}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-2">
          {filteredIds.length} of {albumIds.length} albums
        </span>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              clearAll()
            }}
            className="ml-auto h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" /> Clear
          </Button>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {/* Filter panels */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
          {/* Artists */}
          {options.artists.length > 0 && (
            <FilterRow
              label="Artist"
              values={options.artists}
              selected={filters.artists}
              onToggle={(v) => toggle('artist', v)}
            />
          )}
          {/* Genres */}
          {options.genres.length > 0 && (
            <FilterRow
              label="Genre"
              values={options.genres}
              selected={filters.genres}
              onToggle={(v) => toggle('genre', v)}
            />
          )}
          {/* Decades */}
          {options.decades.length > 0 && (
            <FilterRow
              label="Decade"
              values={options.decades}
              selected={filters.decades}
              onToggle={(v) => toggle('decade', v)}
            />
          )}
          {/* Tags */}
          {options.tags.length > 0 && (
            <FilterRow
              label="Tag"
              values={options.tags}
              selected={filters.tags}
              onToggle={(v) => toggle('tag', v)}
            />
          )}
          {/* Play count */}
          <FilterRow
            label="Play Count"
            values={['never', '1-5', '5+']}
            selected={filters.playCounts}
            onToggle={(v) => toggle('playCount', v)}
            labels={{ never: 'Never played', '1-5': '1–5 plays', '5+': '5+ plays' }}
          />
        </div>
      )}
    </div>
  )
}

function FilterRow({
  label,
  values,
  selected,
  onToggle,
  labels,
}: {
  label: string
  values: string[]
  selected: Set<string>
  onToggle: (v: string) => void
  labels?: Record<string, string>
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => {
          const isSelected = selected.has(v)
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={cn(
                'genre-chip px-2.5 py-1 rounded-full text-[11px] font-medium border',
                isSelected
                  ? 'genre-chip-active'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10',
              )}
            >
              {labels?.[v] || v}
            </button>
          )
        })}
      </div>
    </div>
  )
}
