'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, Plus, Layers, Search, Film } from 'lucide-react'
import { useLibrary } from '@/store/library'
import { PosterArt } from './poster-art'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CollectionManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, we're adding to an existing collection. Otherwise create new. */
  existingCollectionId?: string
  /** Movie IDs to pre-select when creating a new collection (e.g. when opened
   * from a movie detail drawer to "Add to Collection"). */
  initialSelectedMovieIds?: string[]
}

/**
 * Dialog for creating a new collection or adding movies to an existing one.
 * Shows a searchable checklist of all standalone (non-collection) movies.
 */
export function CollectionManager({
  open,
  onOpenChange,
  existingCollectionId,
  initialSelectedMovieIds,
}: CollectionManagerProps) {
  const movies = useLibrary((s) => s.movies)
  const collections = useLibrary((s) => s.collections)
  const createCollection = useLibrary((s) => s.createCollection)
  const addToCollection = useLibrary((s) => s.addToCollection)
  const renameCollection = useLibrary((s) => s.renameCollection)

  const existing = existingCollectionId
    ? collections.find((c) => c.id === existingCollectionId)
    : undefined

  const [title, setTitle] = useState(existing?.title || '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedMovieIds || []),
  )
  const [query, setQuery] = useState('')

  // No useEffect reset — instead, we use the `key` prop on the dialog
  // from the parent to remount this component each time it opens, which
  // naturally resets all useState to its initial values.

  // Available movies = standalone movies + movies already in this collection
  const available = useMemo(() => {
    return movies.filter((m) => {
      if (existing) {
        // When editing existing, show its current members + standalone movies
        return !m.collectionId || m.collectionId === existing.id
      }
      return !m.collectionId
    })
  }, [movies, existing])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return available
    return available.filter((m) => m.title.toLowerCase().includes(q))
  }, [available, query])

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast.error('Select at least 2 movies to create a collection')
      return
    }
    if (ids.length < 2) {
      toast.error('A collection needs at least 2 movies')
      return
    }
    const finalTitle = title.trim() || 'Untitled Collection'
    if (existing) {
      if (title.trim() && title !== existing.title) {
        renameCollection(existing.id, finalTitle)
      }
      addToCollection(existing.id, ids)
      toast.success(`Added ${ids.length} movie${ids.length === 1 ? '' : 's'} to "${finalTitle}"`)
    } else {
      createCollection(finalTitle, ids)
      toast.success(`Created collection "${finalTitle}" with ${ids.length} movie${ids.length === 1 ? '' : 's'}`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="w-5 h-5 text-[var(--accent)]" />
            {existing ? 'Edit Collection' : 'Create New Collection'}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? 'Add more movies to this collection, or rename it. Movies already in other collections are hidden.'
              : 'Group related movies together — perfect for franchises, trilogies, and series. Select at least 2 movies.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Title input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
              Collection Name
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Lord of the Rings, Marvel Cinematic Universe…"
              className="bg-white/5 border-white/10"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${available.length} movies…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10"
            />
          </div>

          {/* Selected count */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              <Check className="w-3.5 h-3.5" />
              <span className="font-medium">
                {selected.size} movie{selected.size === 1 ? '' : 's'} selected
              </span>
              {existing && (
                <span className="text-muted-foreground">
                  (+ {existing.movieIds.length} already in collection)
                </span>
              )}
            </div>
          )}

          {/* Movie list */}
          <ScrollArea className="h-72 rounded-lg border border-border/40">
            <div className="p-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {available.length === 0
                    ? 'No standalone movies available. All your movies are already in collections.'
                    : `No movies match "${query}"`}
                </div>
              ) : (
                filtered.map((m) => {
                  const isSelected = selected.has(m.id)
                  const isAlreadyInCollection =
                    existing && m.collectionId === existing.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg transition text-left',
                        isSelected
                          ? 'bg-[var(--accent)]/15'
                          : 'hover:bg-white/5',
                      )}
                    >
                      <div className="w-10 h-14 rounded overflow-hidden bg-muted shrink-0">
                        <PosterArt coverUrl={m.coverUrl} title={m.title} kind="movie" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{m.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.year || '—'}
                          {isAlreadyInCollection && (
                            <span className="ml-2 text-[var(--accent)]">
                              · already in this collection
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition',
                          isSelected
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]'
                            : 'border-white/20',
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={selected.size < 2 && !existing}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-foreground)] font-semibold"
          >
            <Plus className="w-4 h-4" />
            {existing ? 'Add Selected' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Empty state for the Collections view — explains how collections work. */
export function CollectionsEmptyState({
  onCreate,
  hasMovies,
}: {
  onCreate: () => void
  hasMovies: boolean
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-10 text-center max-w-2xl mx-auto">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
        <Layers className="w-8 h-8 text-[var(--accent)]" />
      </div>
      <h3 className="text-lg font-bold mb-2">No collections yet</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Collections group related movies together — perfect for franchises,
        trilogies, and series. Lumière auto-detects collections using three
        strategies:
      </p>
      <div className="text-left max-w-md mx-auto mb-6 space-y-2">
        <div className="flex items-start gap-2 text-sm">
          <span className="text-[var(--accent)] font-bold shrink-0">1.</span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">Folder structure</strong> —
            movies in the same subfolder (e.g.{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-amber-300 text-xs">Star Wars/</code>) form a collection
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-[var(--accent)] font-bold shrink-0">2.</span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">Shared name prefix</strong> —
            movies sharing their first 2+ words (e.g.{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-amber-300 text-xs">Die Hard</code>,{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-amber-300 text-xs">Die Hard 2</code>)
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-[var(--accent)] font-bold shrink-0">3.</span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">Manual creation</strong> —
            group any movies yourself
          </span>
        </div>
      </div>
      {hasMovies ? (
        <Button
          onClick={onCreate}
          className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-foreground)] font-semibold"
        >
          <Plus className="w-4 h-4" /> Create Collection Manually
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Film className="w-4 h-4" />
          Scan some movies first to create a collection.
        </div>
      )}
    </div>
  )
}
