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
} from 'lucide-react'
import {
  scanWithFSAccess,
  scanFromFileList,
  isFSAccessSupported,
  type ScanProgress,
} from '@/lib/media-scanner'
import { extractMetadata } from '@/lib/metadata'
import { useLibrary } from '@/store/library'
import { toast } from 'sonner'

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
      await processFiles(result.files)
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
      await processFiles(result.files)
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

  const processFiles = async (files: ReturnType<typeof scanFromFileList>['files']) => {
    if (files.length === 0) {
      setPhase('done')
      setScanning(false)
      toast('No media files found in that folder', {
        description: 'Try a folder containing movies, music, or podcasts.',
      })
      return
    }
    setPhase('extracting')
    setTotalToExtract(files.length)
    const metadata: Record<string, Awaited<ReturnType<typeof extractMetadata>>> = {}
    // Extract metadata in parallel batches of 6
    const BATCH = 6
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (f) => {
          try {
            const md = await extractMetadata(f.file)
            metadata[f.id] = md
          } catch (err) {
            console.warn('Failed to extract metadata for', f.name, err)
            metadata[f.id] = { title: f.name.replace(/\.[^.]+$/, '') }
          }
        }),
      )
      setExtracted(Math.min(i + BATCH, files.length))
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0))
    }
    addFiles(files, metadata)
    setScanning(false)
    setPhase('done')
    toast.success(`Library ready — ${files.length} media files catalogued`, {
      description: 'Browse your collection using the sidebar.',
    })
    setTimeout(() => onOpenChange(false), 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5 text-amber-400" />
            Scan Your Computer
          </DialogTitle>
          <DialogDescription>
            Pick any folder on your computer. Lumière will recursively find all
            movies, TV episodes, music, and podcasts, and extract their
            embedded metadata.
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
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Files never leave your browser — Lumière reads them directly
                  from disk using the File System Access API. No uploads, no
                  servers, fully private.
                </p>
              </div>
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
            </div>

            <div className="flex flex-col gap-2">
              {isFSAccessSupported() ? (
                <Button
                  onClick={handleDirectoryPicker}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold"
                >
                  <FolderOpen className="w-4 h-4" />
                  Choose Folder
                </Button>
              ) : (
                <Button
                  onClick={() => hiddenInputRef.current?.click()}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-semibold"
                >
                  <FolderOpen className="w-4 h-4" />
                  Select Folder
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
