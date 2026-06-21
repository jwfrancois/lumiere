'use client'

import { useState, useEffect } from 'react'
import { Menu, ScanLine } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { ScanModal } from '@/components/scan-modal'
import { MediaPlayer } from '@/components/media-player'
import { DetailDrawer } from '@/components/detail-drawer'
import { ReconnectBanner } from '@/components/reconnect-banner'
import { SpotifyNowPlayingBar } from '@/components/spotify-now-playing-bar'
import {
  HomeView,
  MoviesView,
  CollectionsView,
  TvView,
  MusicView,
  PodcastsView,
} from '@/components/library-views'
import { useLibrary } from '@/store/library'
import { useEnrichmentOrchestrator } from '@/hooks/use-enrichment-orchestrator'
import { useMusicEnrichment } from '@/hooks/use-music-enrichment'
import { useNeonSync } from '@/hooks/use-neon-sync'
import { Button } from '@/components/ui/button'
import { EnrichmentIndicator } from '@/components/enrichment-indicator'
import { cn } from '@/lib/utils'

export default function Home() {
  const [scanOpen, setScanOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentView = useLibrary((s) => s.currentView)
  const hasLibrary = useLibrary((s) => s.scannedFiles.length > 0)
  const hydrateFromStorage = useLibrary((s) => s.hydrateFromStorage)

  // Kick off background metadata enrichment for new movies / TV shows.
  useEnrichmentOrchestrator()
  // Kick off background enrichment for music albums + artist bios.
  useMusicEnrichment()
  // Sync library to Neon database (with IndexedDB fallback).
  useNeonSync()

  // CRITICAL: Hydrate the persisted library AFTER React has mounted.
  // The store initializes empty (matching SSR) so the first client render
  // produces identical HTML. This useEffect runs only on the client, after
  // hydration, safely loading from localStorage without mismatch.
  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  // Auto-open the scan modal once on first mount IF the library is empty.
  // If we have persisted data from a previous session, don't bother the user.
  // Note: this checks AFTER hydration, so `hasLibrary` reflects restored data.
  const [autoPrompted, setAutoPrompted] = useState(false)
  useEffect(() => {
    if (!hasLibrary && !autoPrompted) {
      const t = setTimeout(() => {
        setScanOpen(true)
        setAutoPrompted(true)
      }, 500)
      return () => clearTimeout(t)
    }
  }, [hasLibrary, autoPrompted])

  // Allow other components (e.g. ReconnectBanner) to open the scan modal
  // by dispatching a 'lumiere:open-scan' custom event.
  useEffect(() => {
    const handler = () => setScanOpen(true)
    window.addEventListener('lumiere:open-scan', handler)
    return () => window.removeEventListener('lumiere:open-scan', handler)
  }, [])

  // Debug helper — listen for a custom event that injects test data into the
  // store. Used by agent-browser self-verification only.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.files && detail?.metadata) {
        useLibrary.getState().addFiles(
          detail.files,
          detail.metadata,
          detail.folderName || 'Test Folder',
          undefined,
          null,
        )
      }
    }
    window.addEventListener('lumiere:inject', handler as EventListener)
    return () =>
      window.removeEventListener('lumiere:inject', handler as EventListener)
  }, [])

  // Apply view-specific theme class to the root wrapper.
  // - Cinema (Netflix red): movies, collections, tv
  // - Audio (Spotify green): music, podcasts
  // - Default (amber): home
  const themeClass =
    currentView === 'movies' ||
    currentView === 'collections' ||
    currentView === 'tv'
      ? 'theme-cinema'
      : currentView === 'music' || currentView === 'podcasts'
        ? 'theme-audio'
        : ''

  return (
    <div className={cn('min-h-screen flex', themeClass)}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        <Sidebar onScanClick={() => setScanOpen(true)} />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-72">
            <Sidebar
              onScanClick={() => {
                setScanOpen(true)
                setSidebarOpen(false)
              }}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur border-b border-border/40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold gradient-text-amber text-base">Lumière</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScanOpen(true)}
            className="text-amber-300"
          >
            <ScanLine className="w-5 h-5" />
          </Button>
        </header>

        <div
          className={cn(
            'flex-1 px-6 md:px-8 py-6 md:py-8',
            // Add bottom padding for Spotify now-playing bar when in audio views
            (currentView === 'music' || currentView === 'podcasts') &&
              'pb-32',
          )}
        >
          <ReconnectBanner />
          {currentView === 'home' && <HomeView onScanClick={() => setScanOpen(true)} />}
          {currentView === 'movies' && <MoviesView />}
          {currentView === 'collections' && <CollectionsView />}
          {currentView === 'tv' && <TvView />}
          {currentView === 'music' && <MusicView />}
          {currentView === 'podcasts' && <PodcastsView />}
        </div>
      </main>

      {/* Floating enrichment indicator (bottom-left, doesn't block content) */}
      <EnrichmentIndicator />

      {/* Spotify-style persistent now playing bar for audio views */}
      <SpotifyNowPlayingBar />

      <ScanModal open={scanOpen} onOpenChange={setScanOpen} />
      <MediaPlayer />
      <DetailDrawer />
    </div>
  )
}

