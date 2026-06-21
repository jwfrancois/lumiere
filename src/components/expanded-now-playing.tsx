'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown,
  Waves,
  PenTool,
  Music2,
  ListMusic,
  Disc3,
  Clock,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
  Shuffle,
  Repeat,
  Maximize2,
} from 'lucide-react'
import { useLibrary } from '@/store/library'
import { HiFiBadge } from './hifi-badge'
import { SignalPath } from './signal-path'
import { CreditsBrowser } from './credits-browser'
import { formatDuration } from '@/lib/metadata'
import { formatRelativeTime } from '@/lib/listening-history'
import { cn } from '@/lib/utils'

type Tab = 'now-playing' | 'signal-path' | 'credits' | 'lyrics' | 'queue'

/**
 * Roon-style expanded Now Playing overlay.
 *
 * Full-screen player with tabbed panels:
 *  - Now Playing: large art + transport controls
 *  - Signal Path: Roon-style audio chain visualization
 *  - Credits: artist/composer/genre with cross-linking
 *  - Lyrics: synced lyrics (placeholder for future)
 *  - Queue: upcoming tracks
 *
 * Triggered from the Spotify Now Playing bar's expand button.
 */

interface ExpandedNowPlayingProps {
  open: boolean
  onClose: () => void
}

export function ExpandedNowPlaying({ open, onClose }: ExpandedNowPlayingProps) {
  const [tab, setTab] = useState<Tab>('now-playing')
  const queue = useLibrary((s) => s.queue)
  const currentIndex = useLibrary((s) => s.currentIndex)
  const closePlayer = useLibrary((s) => s.closePlayer)
  const albums = useLibrary((s) => s.albums)
  const recordTrackPlay = useLibrary((s) => s.recordTrackPlay)
  const listeningHistory = useLibrary((s) => s.listeningHistory)
  const tagState = useLibrary((s) => s.tagState)
  const addTag = useLibrary((s) => s.addTag)
  const removeTag = useLibrary((s) => s.removeTag)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [liked, setLiked] = useState(false)
  const [hifiEnabled, setHifiEnabled] = useState(true)
  const [bassGain, setBassGain] = useState(3)
  const [midGain, setMidGain] = useState(-1)
  const [trebleGain, setTrebleGain] = useState(2)
  const [presenceGain, setPresenceGain] = useState(3)
  const [outputSampleRate, setOutputSampleRate] = useState<number | undefined>()

  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const playedRef = useRef(false) // track if we've counted this play

  // Find and sync with the audio element
  useEffect(() => {
    if (!open) return
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
        // Get the AudioContext sample rate
        try {
          const Ctor = window.AudioContext
          if (Ctor) {
            const ctx = new Ctor()
            setOutputSampleRate(ctx.sampleRate)
            ctx.close()
          }
        } catch {
          /* ignore */
        }
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
  }, [open, currentIndex])

  // Record play count when track reaches 30 seconds or ends
  useEffect(() => {
    if (!open || !queue[currentIndex]) return
    playedRef.current = false
  }, [currentIndex, open])

  useEffect(() => {
    if (!open || playedRef.current) return
    const item = queue[currentIndex]
    if (!item) return
    // Count as played after 30 seconds OR 50% of duration (whichever first)
    const threshold = duration > 0 ? Math.min(30, duration * 0.5) : 30
    if (currentTime >= threshold) {
      recordTrackPlay(item.id, item.title, item.subtitle, duration)
      playedRef.current = true
    }
  }, [currentTime, duration, open, currentIndex, queue, recordTrackPlay])

  if (!open) return null
  const item = queue[currentIndex]
  if (!item) return null

  // Find the album for credits
  const album = albums.find(
    (a) =>
      a.title === item.metadata.album ||
      a.artist === item.metadata.albumArtist ||
      a.artist === item.metadata.artist,
  )

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const trackStats = listeningHistory.tracks[item.id]

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

  const tabs: { id: Tab; label: string; icon: typeof Waves }[] = [
    { id: 'now-playing', label: 'Now Playing', icon: Disc3 },
    { id: 'signal-path', label: 'Signal Path', icon: Waves },
    { id: 'credits', label: 'Credits', icon: PenTool },
    { id: 'lyrics', label: 'Lyrics', icon: Music2 },
    { id: 'queue', label: 'Queue', icon: ListMusic },
  ]

  return (
    <div className="fixed inset-0 z-[90] bg-background/98 backdrop-blur-2xl flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ChevronDown className="w-5 h-5" />
          Minimize
        </button>
        <div className="flex items-center gap-2">
          <HiFiBadge active={hifiEnabled} />
          {trackStats && (
            <span className="text-[10px] text-muted-foreground">
              Played {trackStats.playCount}× · last {formatRelativeTime(trackStats.lastPlayed)}
            </span>
          )}
        </div>
      </div>

      {/* Body — two columns: art + tabs */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — album art + transport */}
        <div className="w-2/5 max-w-md p-8 flex flex-col items-center justify-center border-r border-border/40">
          <div
            className={cn(
              'relative w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10',
              isPlaying && 'animate-spin-slow',
            )}
            style={{ borderRadius: '50%' }}
          >
            {item.metadata.coverUrl ? (
              <img
                src={item.metadata.coverUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--accent)] to-rose-500 flex items-center justify-center text-black text-4xl">
                ♪
              </div>
            )}
          </div>
          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold truncate">{item.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{item.subtitle}</p>
            {item.metadata.album && (
              <p className="text-xs text-[var(--accent)]/80 mt-0.5">
                {item.metadata.album}
              </p>
            )}
          </div>

          {/* Transport */}
          <div className="w-full mt-6 space-y-3">
            <div className="flex items-center gap-4 justify-center">
              <Shuffle className="w-4 h-4 text-muted-foreground" />
              <SkipBack
                className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => useLibrary.getState().prev()}
              />
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
              <SkipForward
                className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => useLibrary.getState().next()}
              />
              <Repeat className="w-4 h-4 text-muted-foreground" />
            </div>
            {/* Progress */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                {formatDuration(currentTime)}
              </span>
              <div
                onClick={seek}
                className="flex-1 h-1 rounded-full bg-white/15 cursor-pointer group relative"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums w-10">
                {formatDuration(duration)}
              </span>
            </div>
            {/* Volume + like */}
            <div className="flex items-center gap-3">
              <Heart
                className={cn(
                  'w-4 h-4 cursor-pointer',
                  liked ? 'text-[var(--accent)] fill-current' : 'text-muted-foreground',
                )}
                onClick={() => setLiked(!liked)}
              />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
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
          </div>
        </div>

        {/* Right — tabbed panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-border/40">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition',
                    tab === t.id
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto scrollbar-slim p-6">
            {tab === 'now-playing' && (
              <NowPlayingTab
                item={item}
                trackStats={trackStats}
                tags={tagState.itemTags[item.id] || []}
                onAddTag={(t) => addTag(t, item.id)}
                onRemoveTag={(t) => removeTag(t, item.id)}
              />
            )}
            {tab === 'signal-path' && (
              <SignalPath
                trackMetadata={item.metadata}
                hifiEnabled={hifiEnabled}
                bassGain={bassGain}
                midGain={midGain}
                trebleGain={trebleGain}
                presenceGain={presenceGain}
                outputSampleRate={outputSampleRate}
              />
            )}
            {tab === 'credits' && album && (
              <CreditsBrowser
                albumId={album.id}
                artist={album.artist}
                albumArtist={album.albumArtist}
                composer={item.metadata.composer}
                genre={album.genre}
                year={album.year}
                trackCount={album.tracks.length}
              />
            )}
            {tab === 'credits' && !album && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No credit information available for this track.
              </div>
            )}
            {tab === 'lyrics' && (
              <div className="text-center py-12">
                <Music2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Lyrics aren't available for this track.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Lyrics require an online lookup service.
                </p>
              </div>
            )}
            {tab === 'queue' && (
              <QueueTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NowPlayingTab({
  item,
  trackStats,
  tags,
  onAddTag,
  onRemoveTag,
}: {
  item: { id: string; title: string; subtitle?: string; metadata: { album?: string; artist?: string; year?: number; genre?: string; trackNumber?: number; durationSec?: number } }
  trackStats?: { playCount: number; firstPlayed: number; lastPlayed: number; totalDurationSec: number }
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}) {
  const [newTag, setNewTag] = useState('')
  const m = item.metadata

  return (
    <div className="space-y-5 max-w-lg">
      {/* Track metadata */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Track Info
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {m.trackNumber !== undefined && (
            <InfoRow label="Track #" value={String(m.trackNumber)} />
          )}
          {m.year && <InfoRow label="Year" value={String(m.year)} />}
          {m.genre && <InfoRow label="Genre" value={m.genre} />}
          {m.durationSec && (
            <InfoRow label="Duration" value={formatDuration(m.durationSec)} />
          )}
        </div>
      </div>

      {/* Play stats */}
      {trackStats && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Listening Stats
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Plays" value={String(trackStats.playCount)} />
            <StatCard label="First" value={formatRelativeTime(trackStats.firstPlayed)} />
            <StatCard label="Last" value={formatRelativeTime(trackStats.lastPlayed)} />
          </div>
        </div>
      )}

      {/* Tags */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Tags
        </h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => onRemoveTag(t)}
              className="genre-chip genre-chip-active px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1"
            >
              {t} ×
            </button>
          ))}
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">No tags yet</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTag.trim()) {
                onAddTag(newTag.trim())
                setNewTag('')
              }
            }}
            placeholder="Add a tag…"
            className="flex-1 px-2 py-1 text-xs rounded bg-white/5 border border-white/10 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={() => {
              if (newTag.trim()) {
                onAddTag(newTag.trim())
                setNewTag('')
              }
            }}
            className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-xs font-medium truncate">{value}</div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 p-3 text-center">
      <div className="text-lg font-bold text-[var(--accent)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  )
}

function QueueTab() {
  const queue = useLibrary((s) => s.queue)
  const currentIndex = useLibrary((s) => s.currentIndex)
  const playQueue = useLibrary((s) => s.playQueue)
  const isPlaying = useLibrary((s) => {
    const el = document.querySelector('audio') as HTMLAudioElement | null
    return el ? !el.paused : false
  })

  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Up Next ({queue.length})
      </h4>
      <div className="space-y-1">
        {queue.map((item, i) => (
          <button
            key={`${item.id}-${i}`}
            onClick={() => playQueue(queue, i)}
            className={cn(
              'w-full flex items-center gap-3 p-2 rounded-lg transition text-left',
              i === currentIndex
                ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30'
                : 'hover:bg-white/[0.06] border border-transparent',
            )}
          >
            <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
              {item.metadata.coverUrl ? (
                <img src={item.metadata.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/20 to-rose-500/20 text-muted-foreground">
                  ♪
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('text-sm font-medium truncate', i === currentIndex && 'text-[var(--accent)]')}>
                {item.title}
              </div>
              <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
            </div>
            {i === currentIndex && isPlaying && (
              <div className="flex items-end gap-[2px] h-4">
                {[0, 1, 2].map((j) => (
                  <span
                    key={j}
                    className="w-[2px] bg-[var(--accent)] rounded-full eq-bar"
                    style={{ animationDelay: `${j * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            {item.metadata.durationSec && (
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {formatDuration(item.metadata.durationSec)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
