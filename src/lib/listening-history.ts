/**
 * Listening history — Roon-inspired play tracking.
 *
 * Tracks per-track play statistics:
 *  - playCount: how many times the track has been played
 *  - firstPlayed: timestamp of first play
 *  - lastPlayed: timestamp of most recent play
 *  - duration: total seconds listened
 *
 * Also tracks per-album and per-artist aggregate stats.
 *
 * Persisted to localStorage so it survives reloads.
 */

const LS_KEY = 'lumiere:listening-history:v1'

export interface TrackStats {
  playCount: number
  firstPlayed: number // epoch ms
  lastPlayed: number // epoch ms
  totalDurationSec: number
}

export interface ListeningHistory {
  tracks: Record<string, TrackStats>
  /** Track play events for history feed (most recent first). */
  events: Array<{
    trackId: string
    title: string
    subtitle?: string
    timestamp: number
  }>
}

const MAX_EVENTS = 200

export function loadHistory(): ListeningHistory {
  if (typeof window === 'undefined') {
    return { tracks: {}, events: [] }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { tracks: {}, events: [] }
    return JSON.parse(raw) as ListeningHistory
  } catch {
    return { tracks: {}, events: [] }
  }
}

export function saveHistory(history: ListeningHistory): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(history))
  } catch (err) {
    console.warn('saveHistory failed', err)
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LS_KEY)
}

/**
 * Record a play event for a track.
 * Returns the updated history.
 */
export function recordPlay(
  history: ListeningHistory,
  trackId: string,
  title: string,
  subtitle: string | undefined,
  durationSec?: number,
): ListeningHistory {
  const now = Date.now()
  const existing = history.tracks[trackId]
  const updated: TrackStats = {
    playCount: (existing?.playCount || 0) + 1,
    firstPlayed: existing?.firstPlayed || now,
    lastPlayed: now,
    totalDurationSec:
      (existing?.totalDurationSec || 0) + (durationSec || 0),
  }
  const events = [
    { trackId, title, subtitle, timestamp: now },
    ...history.events,
  ].slice(0, MAX_EVENTS)
  return {
    tracks: { ...history.tracks, [trackId]: updated },
    events,
  }
}

/** Get stats for a single track. */
export function getTrackStats(
  history: ListeningHistory,
  trackId: string,
): TrackStats | undefined {
  return history.tracks[trackId]
}

/** Format a timestamp as a relative time string ("just now", "3d ago"). */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const week = Math.floor(day / 7)
  if (week < 4) return `${week}w ago`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mo ago`
  return `${Math.floor(month / 12)}y ago`
}

/** Format a total duration in seconds as "Xh Ym" or "Ym". */
export function formatListenDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
