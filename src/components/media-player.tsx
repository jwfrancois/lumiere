'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Settings2,
  ListMusic,
  Repeat,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Gauge,
  Sliders,
  PlugZap,
  Loader2,
} from 'lucide-react'
import { useLibrary } from '@/store/library'
import type { PlayableItem } from '@/lib/categorize'
import { HiFiBadge } from './hifi-badge'
import { formatDuration } from '@/lib/metadata'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playbackRate: number
  isFullscreen: boolean
  showQueue: boolean
  showSettings: boolean
  // HiFi pipeline
  hifiEnabled: boolean
  bassGain: number // dB, -12..+12
  midGain: number
  trebleGain: number
  presenceGain: number
}

const PRESETS: { name: string; bass: number; mid: number; treble: number; presence: number }[] = [
  { name: 'Flat', bass: 0, mid: 0, treble: 0, presence: 0 },
  { name: 'HiFi Studio', bass: 3, mid: -1, treble: 2, presence: 3 },
  { name: 'Bass Boost', bass: 7, mid: 0, treble: 1, presence: 0 },
  { name: 'Vocal', bass: -1, mid: 4, treble: 2, presence: 3 },
  { name: 'Cinema', bass: 5, mid: -2, treble: 3, presence: 4 },
  { name: 'Late Night', bass: -3, mid: 1, treble: -2, presence: 0 },
]

export function MediaPlayer() {
  const {
    isPlayerOpen,
    closePlayer,
    queue,
    currentIndex,
    next,
    prev,
  } = useLibrary()

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const bassFilterRef = useRef<BiquadFilterNode | null>(null)
  const midFilterRef = useRef<BiquadFilterNode | null>(null)
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null)
  const presenceFilterRef = useRef<BiquadFilterNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    muted: false,
    playbackRate: 1,
    isFullscreen: false,
    showQueue: false,
    showSettings: false,
    hifiEnabled: true,
    bassGain: 3,
    midGain: -1,
    trebleGain: 2,
    presenceGain: 3,
  })

  const currentItem = queue[currentIndex]
  const isVideo = currentItem?.kind === 'video'

  // --- WebAudio HiFi pipeline setup ---
  const applyEQ = useCallback(() => {
    if (!state.hifiEnabled) {
      if (bassFilterRef.current) bassFilterRef.current.gain.value = 0
      if (midFilterRef.current) midFilterRef.current.gain.value = 0
      if (trebleFilterRef.current) trebleFilterRef.current.gain.value = 0
      if (presenceFilterRef.current) presenceFilterRef.current.gain.value = 0
      return
    }
    if (bassFilterRef.current) bassFilterRef.current.gain.value = state.bassGain
    if (midFilterRef.current) midFilterRef.current.gain.value = state.midGain
    if (trebleFilterRef.current) trebleFilterRef.current.gain.value = state.trebleGain
    if (presenceFilterRef.current) presenceFilterRef.current.gain.value = state.presenceGain
  }, [
    state.hifiEnabled,
    state.bassGain,
    state.midGain,
    state.trebleGain,
    state.presenceGain,
  ])

  const setupAudioGraph = useCallback(
    (element: HTMLMediaElement) => {
      // Disconnect any previous source
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect()
        } catch {
          // ignore
        }
        sourceNodeRef.current = null
      }

      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        if (!Ctor) return
        audioCtxRef.current = new Ctor()
      }
      const ctx = audioCtxRef.current!
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          /* ignore */
        })
      }

      try {
        sourceNodeRef.current = ctx.createMediaElementSource(element)
      } catch {
        // element already has a source — abort
        return
      }

      // 4-band EQ: low shelf (bass), peaking (mid), high shelf (treble), peaking (presence)
      bassFilterRef.current = ctx.createBiquadFilter()
      bassFilterRef.current.type = 'lowshelf'
      bassFilterRef.current.frequency.value = 200

      midFilterRef.current = ctx.createBiquadFilter()
      midFilterRef.current.type = 'peaking'
      midFilterRef.current.frequency.value = 1000
      midFilterRef.current.Q.value = 0.8

      trebleFilterRef.current = ctx.createBiquadFilter()
      trebleFilterRef.current.type = 'highshelf'
      trebleFilterRef.current.frequency.value = 4000

      presenceFilterRef.current = ctx.createBiquadFilter()
      presenceFilterRef.current.type = 'peaking'
      presenceFilterRef.current.frequency.value = 8000
      presenceFilterRef.current.Q.value = 1.2

      gainNodeRef.current = ctx.createGain()
      gainNodeRef.current.gain.value = 1

      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.78

      // chain: source → bass → mid → treble → presence → gain → analyser → destination
      sourceNodeRef.current
        .connect(bassFilterRef.current!)
        .connect(midFilterRef.current!)
        .connect(trebleFilterRef.current!)
        .connect(presenceFilterRef.current!)
        .connect(gainNodeRef.current!)
        .connect(analyserRef.current!)
        .connect(ctx.destination)

      // Apply current EQ settings
      applyEQ()
    },
    [applyEQ],
  )

  // Apply EQ whenever EQ state changes
  useEffect(() => {
    applyEQ()
  }, [applyEQ])

  // --- Visualizer animation ---
  useEffect(() => {
    if (!analyserRef.current || !canvasRef.current) return
    if (!state.showSettings && !isVideo) return
    const canvas = canvasRef.current
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const analyser = analyserRef.current
    const bufferLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufferLen)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const w = canvas.width
      const h = canvas.height
      ctx2d.clearRect(0, 0, w, h)

      const barCount = isVideo ? 48 : 64
      const barWidth = w / barCount
      const step = Math.floor(bufferLen / barCount)

      for (let i = 0; i < barCount; i++) {
        const v = data[i * step] / 255
        const barH = v * h * 0.85
        const x = i * barWidth
        const y = h - barH

        const grad = ctx2d.createLinearGradient(0, y, 0, h)
        grad.addColorStop(0, 'rgba(251, 191, 36, 0.95)') // amber-400
        grad.addColorStop(0.6, 'rgba(244, 63, 94, 0.75)') // rose-500
        grad.addColorStop(1, 'rgba(168, 85, 247, 0.45)') // purple-500
        ctx2d.fillStyle = grad
        ctx2d.fillRect(x + 1, y, barWidth - 2, barH)
      }
    }
    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [state.showSettings, isVideo])

  // --- Player event handlers ---
  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current || audioRef.current
    if (!el) return
    // Reset position + duration when new media loads
    setState((s) => ({ ...s, duration: el.duration || 0, currentTime: 0 }))
    // Set up WebAudio graph on first interaction
    if (!sourceNodeRef.current) {
      setupAudioGraph(el)
    }
    // Apply volume / rate
    el.volume = state.volume
    el.muted = state.muted
    el.playbackRate = state.playbackRate
  }, [setupAudioGraph, state.volume, state.muted, state.playbackRate])

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current || audioRef.current
    if (!el) return
    setState((s) => ({ ...s, currentTime: el.currentTime }))
  }, [])

  const handleEnded = useCallback(() => {
    next()
  }, [next])

  const togglePlay = useCallback(async () => {
    const el = videoRef.current || audioRef.current
    if (!el) return
    if (state.isPlaying) {
      el.pause()
    } else {
      // Resume audio context (browser autoplay policy)
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      try {
        await el.play()
      } catch (err) {
        console.warn('playback failed', err)
      }
    }
  }, [state.isPlaying])

  const seek = useCallback((value: number) => {
    const el = videoRef.current || audioRef.current
    if (!el) return
    el.currentTime = value
    setState((s) => ({ ...s, currentTime: value }))
  }, [])

  const changeVolume = useCallback((value: number) => {
    const el = videoRef.current || audioRef.current
    if (el) {
      el.volume = value
      el.muted = value === 0
    }
    setState((s) => ({ ...s, volume: value, muted: value === 0 }))
  }, [])

  const toggleMute = useCallback(() => {
    const el = videoRef.current || audioRef.current
    if (!el) return
    const newMuted = !state.muted
    el.muted = newMuted
    setState((s) => ({ ...s, muted: newMuted }))
  }, [state.muted])

  const changeRate = useCallback((value: number) => {
    const el = videoRef.current || audioRef.current
    if (el) el.playbackRate = value
    setState((s) => ({ ...s, playbackRate: value }))
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen()
        setState((s) => ({ ...s, isFullscreen: true }))
      } catch {
        /* ignore */
      }
    } else {
      try {
        await document.exitFullscreen()
        setState((s) => ({ ...s, isFullscreen: false }))
      } catch {
        /* ignore */
      }
    }
  }, [])

  // When currentItem changes, load the new source and attempt to play.
  // State syncs (isPlaying, duration, currentTime) happen via the media
  // element's own event handlers (onPlay, onPause, onLoadedMetadata, onTimeUpdate).
  useEffect(() => {
    const el = videoRef.current || audioRef.current
    if (!el || !currentItem) return
    el.load()
    const tryPlay = async () => {
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      try {
        await el.play()
      } catch (err) {
        console.warn('autoplay blocked — user must click play', err)
      }
    }
    tryPlay()
  }, [currentIndex, currentItem])

  // Sync isPlaying state when media element fires play/pause
  const handlePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: true }))
  }, [])
  const handlePause = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: false }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isPlayerOpen) return
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          seek(Math.max(0, state.currentTime - 10))
          break
        case 'ArrowRight':
          seek(Math.min(state.duration, state.currentTime + 10))
          break
        case 'ArrowUp':
          changeVolume(Math.min(1, state.volume + 0.05))
          break
        case 'ArrowDown':
          changeVolume(Math.max(0, state.volume - 0.05))
          break
        case 'f':
          toggleFullscreen()
          break
        case 'Escape':
          if (state.isFullscreen) {
            // browser exits fullscreen; we'll catch on fullscreenchange
          } else {
            closePlayer()
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    isPlayerOpen,
    state.currentTime,
    state.duration,
    state.volume,
    state.isFullscreen,
    togglePlay,
    seek,
    changeVolume,
    toggleFullscreen,
    closePlayer,
  ])

  // Listen for fullscreen change (Esc)
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) {
        setState((s) => ({ ...s, isFullscreen: false }))
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  if (!isPlayerOpen || !currentItem) return null

  const progressPct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  // If the current item's underlying File object isn't available (e.g.
  // after a page reload, before the user reconnects the folder), show a
  // friendly prompt instead of a broken player.
  if (currentItem.file.unavailable) {
    return <ReconnectPrompt item={currentItem} onClose={closePlayer} />
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-[100] flex flex-col',
        state.isFullscreen ? 'bg-black' : 'bg-background/95 backdrop-blur-xl',
      )}
    >
      {/* Top bar */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b border-border/40',
          state.isFullscreen && 'absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={closePlayer}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{currentItem.title}</div>
            {currentItem.subtitle && (
              <div className="text-xs text-muted-foreground truncate">
                {currentItem.subtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HiFiBadge active={state.hifiEnabled} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setState((s) => ({ ...s, showQueue: !s.showQueue }))}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              state.showQueue && 'text-amber-300',
            )}
            title="Queue"
          >
            <ListMusic className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setState((s) => ({ ...s, showSettings: !s.showSettings }))}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              state.showSettings && 'text-amber-300',
            )}
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </Button>
          {isVideo && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-muted-foreground hover:text-foreground"
              title="Fullscreen"
            >
              {state.isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Body: video / album art */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Main stage */}
        <div className="flex-1 flex items-center justify-center relative bg-black">
          {isVideo ? (
            <video
              ref={videoRef}
              src={currentItem.file.url}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onClick={togglePlay}
              playsInline
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-8">
              {/* Animated backdrop blur from cover */}
              {currentItem.metadata.coverUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-110"
                  style={{ backgroundImage: `url(${currentItem.metadata.coverUrl})` }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                <div
                  className={cn(
                    'relative aspect-square w-64 md:w-80 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/10 border border-white/10',
                    state.isPlaying && 'animate-spin-slow',
                  )}
                  style={{
                    borderRadius: '50%',
                    backgroundImage:
                      'radial-gradient(circle at center, #1a1a1a 0%, #1a1a1a 28%, transparent 28%), repeating-radial-gradient(circle at center, #1a1a1a 0, #1a1a1a 2px, #0a0a0a 3px, #0a0a0a 4px)',
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {currentItem.metadata.coverUrl ? (
                      <img
                        src={currentItem.metadata.coverUrl}
                        alt={currentItem.title}
                        className="w-1/2 h-1/2 rounded-full object-cover border-4 border-black shadow-2xl"
                      />
                    ) : (
                      <div className="w-1/2 h-1/2 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-black font-bold">
                        ♪
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold">{currentItem.title}</div>
                  {currentItem.subtitle && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {currentItem.subtitle}
                    </div>
                  )}
                  {currentItem.metadata.album && (
                    <div className="text-xs text-amber-300/80 mt-0.5">
                      {currentItem.metadata.album}
                    </div>
                  )}
                </div>
                {/* Visualizer */}
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={80}
                  className="w-full max-w-md h-16"
                />
              </div>
            </div>
          )}
          {/* Hidden audio element used for audio playback */}
          {!isVideo && (
            <audio
              ref={audioRef}
              src={currentItem.file.url}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              className="hidden"
            />
          )}
        </div>

        {/* Settings panel */}
        {state.showSettings && (
          <div className="absolute md:relative right-0 top-0 bottom-0 w-full md:w-80 glass-strong border-l border-border/40 overflow-y-auto scrollbar-slim z-20">
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sliders className="w-4 h-4 text-amber-400" />
                HiFi Studio Sound
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">HiFi Pipeline</span>
                <button
                  onClick={() =>
                    setState((s) => ({ ...s, hifiEnabled: !s.hifiEnabled }))
                  }
                  className={cn(
                    'relative w-10 h-6 rounded-full transition-colors',
                    state.hifiEnabled ? 'bg-amber-500' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                      state.hifiEnabled && 'translate-x-4',
                    )}
                  />
                </button>
              </div>

              {/* Presets */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Presets
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          bassGain: p.bass,
                          midGain: p.mid,
                          trebleGain: p.treble,
                          presenceGain: p.presence,
                          hifiEnabled: true,
                        }))
                      }
                      className="px-2 py-1.5 text-[11px] rounded-md bg-muted/50 hover:bg-amber-500/15 hover:text-amber-300 border border-border/40 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* EQ sliders */}
              {[
                { label: 'Bass', value: state.bassGain, key: 'bassGain' as const, freq: '60–200 Hz' },
                { label: 'Mid', value: state.midGain, key: 'midGain' as const, freq: '1 kHz' },
                { label: 'Treble', value: state.trebleGain, key: 'trebleGain' as const, freq: '4 kHz+' },
                { label: 'Presence', value: state.presenceGain, key: 'presenceGain' as const, freq: '8 kHz' },
              ].map((band) => (
                <div key={band.key}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-medium">{band.label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {band.value > 0 ? '+' : ''}
                      {band.value} dB
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mb-1.5">
                    {band.freq}
                  </div>
                  <Slider
                    value={[band.value]}
                    min={-12}
                    max={12}
                    step={1}
                    onValueChange={(v) =>
                      setState((s) => ({ ...s, [band.key]: v[0] }))
                    }
                    className="cursor-pointer"
                  />
                </div>
              ))}

              {/* Playback speed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    Playback Speed
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {state.playbackRate}x
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].slice(0, 5).map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRate(r)}
                      className={cn(
                        'py-1.5 text-[11px] rounded-md border transition-colors tabular-nums',
                        state.playbackRate === r
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-muted/50 border-border/40 hover:bg-muted',
                      )}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Video visualizer for video too */}
              {isVideo && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Spectrum
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={80}
                    className="w-full h-16 rounded-md bg-black/40"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Queue panel */}
        {state.showQueue && (
          <div className="absolute md:relative right-0 top-0 bottom-0 w-full md:w-80 glass-strong border-l border-border/40 overflow-y-auto scrollbar-slim z-20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-amber-400" />
                  Up Next
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {queue.length} items
                </span>
              </div>
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="space-y-1 pr-2">
                  {queue.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => useLibrary.getState().playQueue(queue, i)}
                      className={cn(
                        'w-full text-left flex items-center gap-2.5 p-2 rounded-lg transition-colors',
                        i === currentIndex
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'hover:bg-muted/60 border border-transparent',
                      )}
                    >
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0 relative">
                        {item.metadata.coverUrl ? (
                          <img
                            src={item.metadata.coverUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            {item.kind === 'video' ? '▶' : '♪'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {i === currentIndex && state.isPlaying && (
                        <HiFiBadge active className="scale-90" />
                      )}
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDuration(item.metadata.durationSec)}
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div
        className={cn(
          'px-4 py-3 border-t border-border/40 bg-background/80 backdrop-blur',
          state.isFullscreen &&
            'absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 to-transparent opacity-0 hover:opacity-100 transition-opacity',
        )}
      >
        {/* Seek bar */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right">
            {formatDuration(state.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={state.duration || 0}
            value={state.currentTime}
            step={0.1}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="player-range flex-1"
            style={{ '--range-progress': `${progressPct}%` } as React.CSSProperties}
          />
          <span className="text-[11px] text-muted-foreground tabular-nums w-12">
            {formatDuration(state.duration)}
          </span>
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prev} disabled={currentIndex === 0}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-black"
            >
              {state.isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={next}
              disabled={currentIndex >= queue.length - 1}
            >
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Repeat">
              <Repeat className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Shuffle">
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 min-w-32 max-w-48">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-muted-foreground">
              {state.muted || state.volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              value={state.muted ? 0 : state.volume}
              step={0.01}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="player-range flex-1"
              style={{
                '--range-progress': `${(state.muted ? 0 : state.volume) * 100}%`,
              } as React.CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Shown when the user tries to play an item whose underlying File object
 * isn't available (e.g. after a page reload). Lets them reconnect the
 * folder with one click if we have an FSA handle, or dismiss the player.
 */
function ReconnectPrompt({
  item,
  onClose,
}: {
  item: PlayableItem
  onClose: () => void
}) {
  const scannedFolders = useLibrary((s) => s.scannedFolders)
  const reconnectFolder = useLibrary((s) => s.reconnectFolder)
  const reconnectAllFolders = useLibrary((s) => s.reconnectAllFolders)
  const isReconnecting = useLibrary((s) => s.isReconnecting)
  const [localLoading, setLocalLoading] = useState(false)

  const folder = scannedFolders.find((f) => f.id === item.file.folderId)

  const handleReconnect = async () => {
    setLocalLoading(true)
    try {
      if (folder) {
        const ok = await reconnectFolder(folder.id)
        if (!ok) {
          // Fallback: try reconnecting all folders
          await reconnectAllFolders()
        }
      } else {
        await reconnectAllFolders()
      }
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="max-w-md mx-4 glass-strong rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <PlugZap className="w-8 h-8 text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold">Reconnect to play</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Browser security requires you to re-grant folder access before
            playing media after a page reload. Your library, posters, and
            ratings are all preserved — just reconnect the folder to play.
          </p>
        </div>
        {folder && (
          <div className="rounded-lg bg-muted/40 border border-border/40 p-3 text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Folder
            </div>
            <div className="text-sm font-mono">{folder.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {item.title}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleReconnect}
            disabled={localLoading || isReconnecting}
            className="flex-1 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold"
          >
            {localLoading || isReconnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Reconnecting…
              </>
            ) : (
              <>
                <PlugZap className="w-4 h-4" /> Reconnect folder
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

