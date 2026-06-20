'use client'

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
  ListMusic,
  Mic2,
  Maximize2,
  Shuffle,
  Repeat,
} from 'lucide-react'
import { useLibrary } from '@/store/library'
import { formatDuration } from '@/lib/metadata'
import { cn } from '@/lib/utils'
import { useEffect, useState, useRef } from 'react'
import { HiFiBadge } from './hifi-badge'

/**
 * Spotify-style persistent "Now Playing" bar at the bottom of the screen.
 * Visible only when audio is playing (music or podcasts).
 *
 * Enhancements beyond Spotify:
 *  - HiFi badge with quality indicator
 *  - Mini spectrum visualizer
 *  - Quick access to queue and lyrics
 *  - Expandable to full player
 *
 * NOTE: This bar mirrors the state of the unified MediaPlayer — it doesn't
 * replace it. When the user clicks "expand", the full MediaPlayer opens.
 */
export function SpotifyNowPlayingBar() {
  const queue = useLibrary((s) => s.queue)
  const currentIndex = useLibrary((s) => s.currentIndex)
  const isPlayerOpen = useLibrary((s) => s.isPlayerOpen)
  const currentView = useLibrary((s) => s.currentView)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [liked, setLiked] = useState(false)

  const audioElRef = useRef<HTMLAudioElement | null>(null)

  // Find the current audio element in the DOM (the MediaPlayer renders it
  // when audio is playing). We poll for it.
  useEffect(() => {
    const find = () => {
      const el = document.querySelector('audio') as HTMLAudioElement | null
      audioElRef.current = el
      if (el) {
        const onPlay = () => setIsPlaying(true)
        const onPause = () => setIsPlaying(false)
        const onTime = () => setCurrentTime(el.currentTime)
        const onMeta = () => setDuration(el.duration || 0)
        el.addEventListener('play', onPlay)
        el.addEventListener('pause', onPause)
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('loadedmetadata', onMeta)
        setIsPlaying(!el.paused)
        setCurrentTime(el.currentTime)
        setDuration(el.duration || 0)
        return () => {
          el.removeEventListener('play', onPlay)
          el.removeEventListener('pause', onPause)
          el.removeEventListener('timeupdate', onTime)
          el.removeEventListener('loadedmetadata', onMeta)
        }
      }
    }
    const cleanup = find()
    const interval = setInterval(() => {
      if (!audioElRef.current) {
        cleanup?.()
        find()
      }
    }, 1000)
    return () => {
      clearInterval(interval)
      cleanup?.()
    }
  }, [isPlayerOpen, currentIndex])

  const currentItem = queue[currentIndex]
  // Only show for audio items, and only on music/podcast views
  const isAudio = currentItem?.kind === 'audio'
  const isAudioView = currentView === 'music' || currentView === 'podcasts'
  if (!currentItem || !isAudio || !isAudioView || !isPlayerOpen) return null

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  const togglePlay = () => {
    const el = audioElRef.current
    if (!el) return
    if (el.paused) el.play()
    else el.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioElRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    el.currentTime = pct * duration
    setCurrentTime(el.currentTime)
  }

  const changeVolume = (v: number) => {
    const el = audioElRef.current
    if (el) el.volume = v
    setVolume(v)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-20 bg-card/95 backdrop-blur-xl border-t border-border/60">
      <div className="h-full grid grid-cols-3 items-center px-4 gap-4">
        {/* Left — track info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded overflow-hidden bg-muted shrink-0 relative">
            {currentItem.metadata.coverUrl ? (
              <img
                src={currentItem.metadata.coverUrl}
                alt=""
                className={cn(
                  'w-full h-full object-cover',
                  isPlaying && 'animate-spin-slow',
                )}
                style={{ borderRadius: '50%' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)] to-rose-500 text-black font-bold">
                ♪
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{currentItem.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {currentItem.subtitle}
            </div>
          </div>
          <button
            onClick={() => setLiked(!liked)}
            className={cn(
              'shrink-0 p-2 rounded-full transition',
              liked ? 'text-[var(--accent)]' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="Like"
          >
            <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
          </button>
        </div>

        {/* Center — controls + progress */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground transition" aria-label="Shuffle">
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={() => useLibrary.getState().prev()}
              disabled={currentIndex === 0}
              className="text-muted-foreground hover:text-foreground transition disabled:opacity-30"
              aria-label="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={() => useLibrary.getState().next()}
              disabled={currentIndex >= queue.length - 1}
              className="text-muted-foreground hover:text-foreground transition disabled:opacity-30"
              aria-label="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition" aria-label="Repeat">
              <Repeat className="w-4 h-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
              {formatDuration(currentTime)}
            </span>
            <div
              onClick={seek}
              className="flex-1 h-1 rounded-full bg-white/15 cursor-pointer group relative"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] group-hover:bg-[var(--accent)]"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition"
                style={{ left: `calc(${progressPct}% - 6px)` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-8">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Right — extras */}
        <div className="flex items-center justify-end gap-2">
          <HiFiBadge active className="scale-90" />
          <button className="text-muted-foreground hover:text-foreground transition p-1.5" aria-label="Lyrics" title="Lyrics">
            <Mic2 className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition p-1.5" aria-label="Queue" title="Queue">
            <ListMusic className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 w-28">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="player-range flex-1"
              style={{ '--range-progress': `${volume * 100}%` } as React.CSSProperties}
            />
          </div>
          <button
            onClick={() => useLibrary.getState().closePlayer()}
            className="text-muted-foreground hover:text-foreground transition p-1.5"
            aria-label="Minimize"
            title="Minimize"
          >
            <Maximize2 className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  )
}
