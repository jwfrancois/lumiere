'use client'

import { cn } from '@/lib/utils'

interface GenreFilterProps {
  genres: string[]
  selected: string | null
  onSelect: (genre: string | null) => void
}

/**
 * Netflix-style genre filter chips. Selecting "All" clears the filter.
 */
export function GenreFilter({ genres, selected, onSelect }: GenreFilterProps) {
  if (genres.length === 0) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto rail-scroll pb-2 mb-4">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'genre-chip px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
          selected === null
            ? 'genre-chip-active'
            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground',
        )}
      >
        All
      </button>
      {genres.map((g) => (
        <button
          key={g}
          onClick={() => onSelect(g)}
          className={cn(
            'genre-chip px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap',
            selected === g
              ? 'genre-chip-active'
              : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground',
          )}
        >
          {g}
        </button>
      ))}
    </div>
  )
}

/** Extract unique genres from enrichment data across a list of enrichment keys. */
export function collectGenres(
  enrichment: Record<string, { genre?: string }>,
  keys: string[],
): string[] {
  const set = new Set<string>()
  for (const k of keys) {
    const e = enrichment[k]
    if (e?.genre) {
      // Split comma-separated genres
      for (const g of e.genre.split(',')) {
        const trimmed = g.trim()
        if (trimmed && trimmed !== 'N/A') set.add(trimmed)
      }
    }
  }
  return Array.from(set).sort()
}
