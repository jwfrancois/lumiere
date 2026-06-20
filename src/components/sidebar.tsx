'use client'

import {
  Home,
  Film,
  Layers,
  Tv,
  Music,
  Mic,
  ScanLine,
  Library,
  X,
  FolderPlus,
} from 'lucide-react'
import { useLibrary, type ViewName } from '@/store/library'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HiFiBadge } from './hifi-badge'

interface SidebarProps {
  onScanClick: () => void
  onClose?: () => void
}

const NAV_ITEMS: { id: ViewName; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'tv', label: 'TV Shows', icon: Tv },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
]

export function Sidebar({ onScanClick, onClose }: SidebarProps) {
  const currentView = useLibrary((s) => s.currentView)
  const setView = useLibrary((s) => s.setView)
  const stats = useLibrary((s) => s.stats)
  const scannedFolders = useLibrary((s) => s.scannedFolders)
  const hasLibrary = scannedFolders.length > 0
  const disconnectedCount = scannedFolders.filter((f) => !f.connected).length
  const totalFileCount = scannedFolders.reduce((s, f) => s + f.fileCount, 0)

  return (
    <aside className="h-full w-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Library className="w-5 h-5 text-black/80" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight gradient-text-amber">
              Lumière
            </span>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Media Library
            </span>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Scan / Add-more button */}
      <div className="px-3 pb-3">
        <Button
          onClick={onScanClick}
          className="w-full justify-start gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold border-0 shadow-md shadow-amber-500/20"
        >
          {hasLibrary ? (
            <FolderPlus className="w-4 h-4" />
          ) : (
            <ScanLine className="w-4 h-4" />
          )}
          {hasLibrary ? 'Add Another Folder' : 'Scan My Computer'}
        </Button>
        {hasLibrary && (
          <div className="mt-1.5 px-2 text-[10px] text-muted-foreground/70 text-center">
            {scannedFolders.length} folder{scannedFolders.length === 1 ? '' : 's'} •{' '}
            {totalFileCount} files
            {disconnectedCount > 0 && (
              <span className="ml-1 text-amber-400">
                • {disconnectedCount} offline
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2 flex-1 overflow-y-auto scrollbar-slim">
        <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Library
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          let count: number | undefined
          if (stats) {
            switch (item.id) {
              case 'movies':
                count = stats.standaloneMovies
                break
              case 'collections':
                count = stats.collections
                break
              case 'tv':
                count = stats.tvShows
                break
              case 'music':
                count = stats.albums
                break
              case 'podcasts':
                count = stats.podcasts
                break
            }
          }
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group',
                isActive
                  ? 'bg-sidebar-accent text-amber-300 shadow-inner'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-colors',
                  isActive
                    ? 'text-amber-400'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={2}
              />
              <span className="flex-1 text-left font-medium">{item.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full tabular-nums',
                    isActive
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/5 text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer — HiFi badge */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Powered by WebAudio</span>
          <HiFiBadge active />
        </div>
      </div>
    </aside>
  )
}
