'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useLibrary } from '@/store/library'

/**
 * Small floating indicator shown in the bottom-left corner while the
 * background metadata enrichment is running. Lets the user know why
 * posters / ratings may be appearing progressively.
 */
export function EnrichmentIndicator() {
  const isEnriching = useLibrary((s) => s.isEnriching)
  const enrichment = useLibrary((s) => s.enrichment)

  // Count items with successful enrichment for a "X found" feel.
  const enrichedCount = Object.values(enrichment).filter(
    (e) => e && Object.keys(e).length > 0,
  ).length

  if (!isEnriching) return null

  return (
    <div className="fixed bottom-4 left-4 z-30 glass-strong rounded-full px-4 py-2 flex items-center gap-2.5 shadow-lg pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
      <span className="text-xs text-foreground font-medium">
        Fetching posters &amp; ratings
      </span>
      {enrichedCount > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {enrichedCount} found
        </span>
      )}
      <Sparkles className="w-3 h-3 text-amber-400/70" />
    </div>
  )
}
