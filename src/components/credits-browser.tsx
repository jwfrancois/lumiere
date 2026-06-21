'use client'

import { useLibrary } from '@/store/library'
import { User, Disc3, Mic2, Music2, PenTool, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Roon-style Credits browser.
 *
 * Shows all production credits for an album/track:
 *  - Artist / Album Artist
 *  - Composer
 *  - Performer (from metadata)
 *  - Producer / Engineer (if available)
 *  - Label (if available)
 *
 * Each credit is clickable — clicking an artist/composer shows all other
 * albums in your library that share that credit. This mirrors Roon's
 * hyperlinked metadata cross-referencing.
 */

interface CreditsBrowserProps {
  albumId: string
  artist: string
  albumArtist?: string
  composer?: string
  genre?: string
  year?: number
  trackCount?: number
}

export function CreditsBrowser({
  albumId,
  artist,
  albumArtist,
  composer,
  genre,
  year,
  trackCount,
}: CreditsBrowserProps) {
  const albums = useLibrary((s) => s.albums)
  const openDetail = useLibrary((s) => s.openDetail)

  // Find related albums (same artist or same composer)
  const relatedByArtist = albums.filter(
    (a) => a.id !== albumId && a.artist === artist,
  )
  const relatedByComposer = composer
    ? albums.filter(
        (a) =>
          a.id !== albumId &&
          a.tracks.some((t) => t.metadata.composer === composer),
      )
    : []
  const relatedByGenre = genre
    ? albums.filter(
        (a) => a.id !== albumId && a.genre && a.genre === genre,
      )
    : []

  const credits = [
    { icon: User, label: 'Artist', value: artist },
    albumArtist &&
    albumArtist !== artist && { icon: User, label: 'Album Artist', value: albumArtist },
    composer && { icon: PenTool, label: 'Composer', value: composer },
    genre && { icon: Music2, label: 'Genre', value: genre },
    year && { icon: Disc3, label: 'Year', value: String(year) },
    trackCount && { icon: Mic2, label: 'Tracks', value: String(trackCount) },
  ].filter(Boolean) as { icon: typeof User; label: string; value: string }[]

  return (
    <div className="space-y-4">
      {/* Credits grid */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Credits
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {credits.map((c) => {
            const Icon = c.icon
            return (
              <div
                key={c.label}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40"
              >
                <Icon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </div>
                  <div className="text-xs font-medium truncate">{c.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Related albums by artist */}
      {relatedByArtist.length > 0 && (
        <RelatedSection
          title={`More from ${artist}`}
          albums={relatedByArtist}
          onAlbumClick={(id) => openDetail({ kind: 'album', id })}
        />
      )}

      {/* Related albums by composer */}
      {relatedByComposer.length > 0 && (
        <RelatedSection
          title={`Also composed by ${composer}`}
          albums={relatedByComposer}
          onAlbumClick={(id) => openDetail({ kind: 'album', id })}
        />
      )}

      {/* Related albums by genre */}
      {relatedByGenre.length > 0 && (
        <RelatedSection
          title={`More ${genre}`}
          albums={relatedByGenre.slice(0, 6)}
          onAlbumClick={(id) => openDetail({ kind: 'album', id })}
        />
      )}
    </div>
  )
}

function RelatedSection({
  title,
  albums,
  onAlbumClick,
}: {
  title: string
  albums: Array<{ id: string; title: string; artist: string; coverUrl?: string; year?: number }>
  onAlbumClick: (id: string) => void
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {albums.map((a) => (
          <button
            key={a.id}
            onClick={() => onAlbumClick(a.id)}
            className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/[0.06] transition text-left group"
          >
            <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
              {a.coverUrl ? (
                <img src={a.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/20 to-rose-500/20">
                  <Disc3 className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                {a.title}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {a.artist} {a.year && `· ${a.year}`}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
