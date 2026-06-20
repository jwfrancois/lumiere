'use client'

import { useState, useEffect } from 'react'
import { Menu, ScanLine } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { ScanModal } from '@/components/scan-modal'
import { MediaPlayer } from '@/components/media-player'
import { DetailDrawer } from '@/components/detail-drawer'
import {
  HomeView,
  MoviesView,
  CollectionsView,
  TvView,
  MusicView,
  PodcastsView,
} from '@/components/library-views'
import { useLibrary } from '@/store/library'
import { Button } from '@/components/ui/button'

export default function Home() {
  const [scanOpen, setScanOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const currentView = useLibrary((s) => s.currentView)
  const hasLibrary = useLibrary((s) => s.scannedFiles.length > 0)

  // Auto-open the scan modal once on first mount if the library is empty.
  // We use a ref-like guard so the modal doesn't re-open when the user
  // explicitly closes it without scanning.
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

  // Debug helper — listen for a custom event that injects test data into the
  // store. Used by agent-browser self-verification only.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.files && detail?.metadata) {
        useLibrary.getState().addFiles(detail.files, detail.metadata)
      }
    }
    window.addEventListener('lumiere:inject', handler as EventListener)
    return () =>
      window.removeEventListener('lumiere:inject', handler as EventListener)
  }, [])

  return (
    <div className="min-h-screen flex">
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

        <div className="flex-1 px-6 md:px-8 py-6 md:py-8">
          {currentView === 'home' && <HomeView onScanClick={() => setScanOpen(true)} />}
          {currentView === 'movies' && <MoviesView />}
          {currentView === 'collections' && <CollectionsView />}
          {currentView === 'tv' && <TvView />}
          {currentView === 'music' && <MusicView />}
          {currentView === 'podcasts' && <PodcastsView />}
        </div>
      </main>

      <ScanModal open={scanOpen} onOpenChange={setScanOpen} />
      <MediaPlayer />
      <DetailDrawer />
    </div>
  )
}
