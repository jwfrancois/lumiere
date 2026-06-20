'use client'

import { WifiOff, RefreshCw, PlugZap, Loader2 } from 'lucide-react'
import { useLibrary } from '@/store/library'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

/**
 * Dismissible banner shown at the top of the main content area when any
 * scanned folder is disconnected (i.e. its File objects aren't available
 * for playback). Lets the user reconnect all folders with one click.
 */
export function ReconnectBanner() {
  const scannedFolders = useLibrary((s) => s.scannedFolders)
  const reconnectAllFolders = useLibrary((s) => s.reconnectAllFolders)
  const isReconnecting = useLibrary((s) => s.isReconnecting)
  const setScanOpen = useState(false)[1] // unused; we use the global scan modal
  void setScanOpen

  const disconnected = scannedFolders.filter((f) => !f.connected)
  const hasFsaHandles = disconnected.some((f) => f.hasFsaHandle)

  if (disconnected.length === 0) return null

  const handleReconnect = async () => {
    if (hasFsaHandles) {
      await reconnectAllFolders()
    } else {
      // No FSA handles — open the scan modal so the user can re-pick folders
      window.dispatchEvent(new CustomEvent('lumiere:open-scan'))
    }
  }

  return (
    <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-amber-100">
          {disconnected.length} folder{disconnected.length === 1 ? '' : 's'} need{disconnected.length === 1 ? 's' : ''} reconnecting
        </h3>
        <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
          Your library, posters, and ratings are all preserved — you just
          need to re-grant folder access before you can play media.
        </p>
      </div>
      <Button
        size="sm"
        onClick={handleReconnect}
        disabled={isReconnecting}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0"
      >
        {isReconnecting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reconnecting…
          </>
        ) : hasFsaHandles ? (
          <>
            <PlugZap className="w-3.5 h-3.5" /> Reconnect all
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" /> Re-scan folders
          </>
        )}
      </Button>
    </div>
  )
}
