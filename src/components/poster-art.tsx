'use client'

import { Film, Music, Mic, Tv, FolderOpen, Sparkles } from 'lucide-react'

interface PosterArtProps {
  coverUrl?: string
  title: string
  kind: 'movie' | 'tv' | 'album' | 'podcast' | 'collection'
  className?: string
  /** When true, round the corners more (album style). */
  square?: boolean
}

const ICONS = {
  movie: Film,
  tv: Tv,
  album: Music,
  podcast: Mic,
  collection: FolderOpen,
}

const GRADIENTS = [
  'from-amber-500/30 via-rose-500/20 to-purple-700/30',
  'from-emerald-500/25 via-teal-500/15 to-sky-700/25',
  'from-rose-500/30 via-pink-500/20 to-orange-700/30',
  'from-indigo-500/25 via-violet-500/20 to-fuchsia-700/25',
  'from-yellow-500/25 via-amber-500/20 to-red-700/25',
  'from-cyan-500/25 via-blue-500/15 to-violet-700/25',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * Renders a media poster. If we have embedded cover art, use it.
 * Otherwise generate a tasteful gradient placeholder with the
 * appropriate icon and title.
 */
export function PosterArt({
  coverUrl,
  title,
  kind,
  className = '',
  square = false,
}: PosterArtProps) {
  const Icon = ICONS[kind]
  const gradientIdx = hashString(title) % GRADIENTS.length

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        loading="lazy"
        className={`w-full h-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br ${
        GRADIENTS[gradientIdx]
      } ${className}`}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.4) 0, transparent 40%)',
        }}
      />
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-white/85 p-3 ${
          square ? 'rounded-xl' : ''
        }`}
      >
        <Icon className="w-1/4 h-1/4 max-w-16 max-h-16 mb-2 opacity-80" strokeWidth={1.2} />
        <span className="text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-1">
          {kind === 'collection' && <Sparkles className="w-3 h-3" />}
          {kind}
        </span>
        <span className="mt-1 text-center text-sm font-semibold line-clamp-3 px-2 leading-tight">
          {title}
        </span>
      </div>
    </div>
  )
}
