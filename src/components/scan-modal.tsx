'use client'

import { useRef, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ScanLine,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  FolderPlus,
  Trash2,
  Film,
  Tv,
  Music,
  Mic,
  Layers,
  RefreshCw,
  PlugZap,
  WifiOff,
} from 'lucide-react'
import {
  scanWithFSAccess,
  scanFromFileList,
  isFSAccessSupported,
  type ScanProgress,
} from '@/lib/media-scanner'
import { extractMetadata, type MediaMetadata } from '@/lib/metadata'
import { useLibrary } from '@/store/library'
import { categorizeFiles } from '@/lib/categorize'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ScanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ScanPhase = 'idle' | 'scanning' | 'extracting' | 'done' | 'error'

export function ScanModal({ open, onOpenChange }: ScanModalProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [progress, setProgress] = useState<ScanProgress>({
    scanned: 0,
    found: 0,
    currentPath: '',
  })
  const [extracted, setExtracted] = useState(0)
  const [totalToExtract, setTotalToExtract] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const addFiles = useLibrary((s) => s.addFiles)
  const setScanning = useLibrary((s) => s.setScanning)
  const scannedFolders = useLibrary((s) => s.scannedFolders)
  const stats = useLibrary((s) => s.stats)
  const reset = useLibrary((s) => s.reset)
  const reconnectFolder = useLibrary((s) => s.reconnectFolder)
  const reconnectAllFolders = useLibrary((s) => s.reconnectAllFolders)
  const isReconnecting = useLibrary((s) => s.isReconnecting)

  const hasLibrary = scannedFolders.length > 0
  const disconnectedFolders = scannedFolders.filter((f) => !f.connected)
  const hasDisconnectedFolders = disconnectedFolders.length > 0

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhase('idle')
      setProgress({ scanned: 0, found: 0, currentPath: '' })
      setExtracted(0)
      setTotalToExtract(0)
      setErrorMsg('')
    }
  }, [open])

  const handleDirectoryPicker = async () => {
    setPhase('scanning')
    setScanning(true)
    try {
      const result = await scanWithFSAccess((p) => setProgress(p))
      if (!result) {
        // user cancelled or unsupported — fall back to input
        setPhase('idle')
        setScanning(false)
        return
      }
      await processFiles(result.files, result.folderName, undefined, result.fsaHandle)
    } catch (err) {
      console.error(err)
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed')
      setPhase('error')
      setScanning(false)
    }
  }

  const handleInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      onOpenChange(false)
      return
    }
    setPhase('scanning')
    setScanning(true)
    try {
      const result = scanFromFileList(files)
      setProgress({
        scanned: result.files.length,
        found: result.files.length,
        currentPath: '',
      })
      // Classic input picker — no FSA handle available
      await processFiles(result.files, result.folderName, undefined, null)
    } catch (err) {
      console.error(err)
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed')
      setPhase('error')
      setScanning(false)
    } finally {
      // Reset input so re-selecting same folder works
      e.target.value = ''
    }
  }

  const processFiles = async (
    files: ReturnType<typeof scanFromFileList>['files'],
    folderName?: string,
    folderId?: string,
    fsaHandle?: FileSystemDirectoryHandle | null,
  ) => {
    if (files.length === 0) {
      setPhase('done')
      setScanning(false)
      toast('No media files found in that folder', {
        description: 'Try a folder containing movies, music, or podcasts.',
      })
      return
    }

    // ── PHASE 1: FAST CATALOG ────────────────────────────────────────
    // Add all files to the store IMMEDIATELY with minimal metadata
    // (just title from filename). No binary parsing, no cover art
    // extraction, no duration probing. This is near-instant and uses
    // almost no memory because we're just storing strings.
    //
    // The categorizer groups files into movies/TV/albums/podcasts
    // based on filename patterns alone — no metadata needed.
    setPhase('scanning')
    const minimalMetadata: Record<string, { title: string }> = {}
    for (const f of files) {
      minimalMetadata[f.id] = {
        title: f.name.replace(/\.[^.]+$/, '').replace(/[._]/g, ' ').trim(),
      }
    }

    // Add all files at once — single categorization pass, single persist
    addFiles(files, minimalMetadata, folderName, folderId, fsaHandle)

    // ── PHASE 2: BACKGROUND METADATA EXTRACTION ──────────────────────
    // Extract real metadata one file at a time. Re-categorize every
    // 10 files (not every file) to reduce CPU/memory pressure.
    setPhase('extracting')
    setTotalToExtract(files.length)
    let pendingMetaUpdates: Record<string, MediaMetadata> = {}

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      try {
        const md = await extractMetadata(f.file, true)
        pendingMetaUpdates[f.id] = md
      } catch (err) {
        console.warn('Metadata extraction failed for', f.name, err)
      }
      setExtracted(i + 1)

      // Batch re-categorize every 10 files (or on the last file)
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        const currentState = useLibrary.getState()
        const updatedMeta = { ...currentState.rawMetadata, ...pendingMetaUpdates }
        useLibrary.setState({ rawMetadata: updatedMeta })
        // Re-categorize
        const input = currentState.scannedFiles.map((sf) => ({
          file: sf,
          metadata: updatedMeta[sf.id] || ({} as MediaMetadata),
        }))
        const result = categorizeFiles(input)
        useLibrary.setState({
          movies: result.movies,
          collections: result.collections,
          tvShows: result.tvShows,
          albums: result.albums,
          podcasts: result.podcasts,
          stats: result.stats,
        })
        pendingMetaUpdates = {} // clear batch
      }

      // Yield to event loop for GC + UI paint
      await new Promise((r) => setTimeout(r, 0))
    }

    // Final persist
    useLibrary.getState().persist()
    setScanning(false)
    setPhase('done')
    toast.success(
      `${folderId ? 'Reconnected' : 'Added'} ${files.length} media file${files.length === 1 ? '' : 's'}${folderName ? ' from ' + folderName : ''}`,
      {
        description: hasLibrary
          ? 'Your library has been updated with the new items.'
          : 'Browse your collection using the sidebar.',
      },
    )
    setTimeout(() => onOpenChange(false), 800)
  }

  /** Reconnect a previously-scanned folder using its stored FSA handle. */
  const handleReconnect = async (folderId: string, folderName: string) => {
    const ok = await reconnectFolder(folderId)
    if (ok) {
      toast.success(`Reconnected "${folderName}"`, {
        description: 'You can now play media from this folder again.',
      })
    } else {
      toast.error(`Couldn't reconnect "${folderName}"`, {
        description: 'The folder may have been moved or deleted. Try re-scanning it.',
      })
    }
  }

  /** Reconnect all disconnected folders at once. */
  const handleReconnectAll = async () => {
    setPhase('scanning')
    setScanning(true)
    try {
      await reconnectAllFolders()
      toast.success('Reconnected all folders')
    } catch (err) {
      console.error(err)
      toast.error('Reconnect failed')
    } finally {
      setScanning(false)
      setPhase('idle')
    }
  }

  const handleClearAll = () => {
    reset()
    setPhase('idle')
    toast('Library cleared', {
      description: 'Scan a folder to start a fresh library.',
    })
    setTimeout(() => onOpenChange(false), 200)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5 text-amber-400" />
            {hasLibrary ? 'Add Another Folder' : 'Scan Your Computer'}
          </DialogTitle>
          <DialogDescription>
            {hasLibrary
              ? 'Pick another folder to add more media. New items are merged into your existing library — nothing is removed.'
              : 'Pick any folder on your computer. Lumière will recursively find all movies, TV episodes, music, and podcasts, and extract their embedded metadata.'}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={hiddenInputRef}
          type="file"
          // @ts-expect-error - webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleInputChange}
        />

        {phase === 'idle' && (
          <div className="space-y-4 py-2">
            {/* Already-scanned folders summary */}
            {hasLibrary && (
              <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {hasDisconnectedFolders ? 'Library — needs reconnect' : 'Already in library'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" /> Clear all
                  </Button>
                </div>

                {/* Reconnect banner — shown when any folder is disconnected */}
                {hasDisconnectedFolders && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <WifiOff className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        After a page reload, browser security requires you to
                        re-grant folder access before playback. Your library,
                        posters, and ratings are all preserved — just click
                        Reconnect.
                      </p>
                    </div>
                    {isFSAccessSupported() && disconnectedFolders.some((f) => f.hasFsaHandle) && (
                      <Button
                        size="sm"
                        onClick={handleReconnectAll}
                        disabled={isReconnecting}
                        className="w-full h-7 text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                      >
                        {isReconnecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <PlugZap className="w-3 h-3" />
                        )}
                        Reconnect all ({disconnectedFolders.filter((f) => f.hasFsaHandle).length})
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-slim">
                  {scannedFolders.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-center gap-2 text-xs py-1 px-1.5 rounded',
                        f.connected
                          ? 'bg-transparent'
                          : 'bg-amber-500/5 border border-amber-500/20',
                      )}
                    >
                      <FolderOpen
                        className={cn(
                          'w-3.5 h-3.5 shrink-0',
                          f.connected ? 'text-amber-400/80' : 'text-amber-400/40',
                        )}
                      />
                      <span className="flex-1 truncate font-mono text-muted-foreground">
                        {f.name}
                      </span>
                      {f.connected ? (
                        <span className="text-[9px] text-emerald-400/80 uppercase tracking-wider shrink-0">
                          ● live
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400/70 uppercase tracking-wider shrink-0">
                          ○ offline
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
                        {f.fileCount}
                      </span>
                      {!f.connected && f.hasFsaHandle && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReconnect(f.id, f.name)}
                          disabled={isReconnecting}
                          className="h-6 px-1.5 text-[10px] text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                        >
                          <RefreshCw className={cn('w-2.5 h-2.5', isReconnecting && 'animate-spin')} />
                          Reconnect
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {stats && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                    {[
                      { label: 'Movies', count: stats.standaloneMovies, icon: Film },
                      { label: 'Collections', count: stats.collections, icon: Layers },
                      { label: 'TV', count: stats.tvShows, icon: Tv },
                      { label: 'Music', count: stats.albums, icon: Music },
                      { label: 'Podcasts', count: stats.podcasts, icon: Mic },
                    ].filter((s) => s.count > 0).map((s) => {
                      const Icon = s.icon
                      return (
                        <div
                          key={s.label}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/60 text-[10px]"
                        >
                          <Icon className="w-3 h-3 text-amber-400/80" />
                          <span className="text-muted-foreground">{s.count}</span>
                          <span className="text-muted-foreground/70">{s.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Files never leave your browser — Lumière reads them directly
                  from disk using the File System Access API. No uploads, no
                  servers, fully private.
                </p>
              </div>
              {!hasLibrary && (
                <div className="flex items-start gap-2.5">
                  <FolderOpen className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    For best organization, point at a folder like{' '}
                    <code className="px-1 py-0.5 rounded bg-background text-amber-300 text-[10px]">
                      ~/Media
                    </code>{' '}
                    with subfolders for Movies, TV Shows, Music, Podcasts.
                  </p>
                </div>
              )}
              {hasLibrary && (
                <div className="flex items-start gap-2.5">
                  <FolderPlus className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You can scan as many folders as you like — they all merge
                    into a single library. Tip: scan your{' '}
                    <code className="px-1 py-0.5 rounded bg-background text-amber-300 text-[10px]">
                      TV Shows
                    </code>
                    ,{' '}
                    <code className="px-1 py-0.5 rounded bg-background text-amber-300 text-[10px]">
                      Music
                    </code>
                    , and{' '}
                    <code className="px-1 py-0.5 rounded bg-background text-amber-300 text-[10px]">
                      Podcasts
                    </code>{' '}
                    folders separately.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {isFSAccessSupported() ? (
                <Button
                  onClick={handleDirectoryPicker}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold"
                >
                  <FolderPlus className="w-4 h-4" />
                  {hasLibrary ? 'Choose Another Folder' : 'Choose Folder'}
                </Button>
              ) : (
                <Button
                  onClick={() => hiddenInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold"
                >
                  <FolderPlus className="w-4 h-4" />
                  {hasLibrary ? 'Select Another Folder' : 'Select Folder'}
                </Button>
              )}
              {isFSAccessSupported() && (
                <Button
                  variant="ghost"
                  onClick={() => hiddenInputRef.current?.click()}
                  className="w-full text-muted-foreground"
                >
                  Use classic folder picker instead
                </Button>
              )}
            </div>
          </div>
        )}

        {(phase === 'scanning' || phase === 'extracting') && (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span className="text-foreground">
                {phase === 'scanning'
                  ? 'Scanning folder for media…'
                  : 'Extracting embedded metadata…'}
              </span>
            </div>

            {phase === 'scanning' && (
              <div className="space-y-1.5">
                <Progress
                  value={progress.scanned > 0 ? 50 : 10}
                  className="h-1.5 bg-muted"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{progress.scanned} entries scanned</span>
                  <span>{progress.found} media files found</span>
                </div>
                <div className="text-[11px] text-muted-foreground/70 truncate font-mono">
                  {progress.currentPath || '—'}
                </div>
              </div>
            )}

            {phase === 'extracting' && (
              <div className="space-y-1.5">
                <Progress
                  value={totalToExtract > 0 ? (extracted / totalToExtract) * 100 : 0}
                  className="h-1.5 bg-muted"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>Reading tags &amp; cover art</span>
                  <span>
                    {extracted} / {totalToExtract}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="py-6 flex flex-col items-center text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <div className="text-base font-semibold">Library Updated</div>
            <div className="text-xs text-muted-foreground">
              Catalogued {progress.found} media files with embedded metadata.
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-4 flex flex-col items-center text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <div className="text-base font-semibold">Scan Failed</div>
            <div className="text-xs text-muted-foreground max-w-xs">
              {errorMsg}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
