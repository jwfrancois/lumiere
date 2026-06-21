'use client'

import { useLibrary } from '@/store/library'
import { Disc3, Sliders, Gauge, Waves, Volume2, Speaker, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Roon-style Signal Path visualization.
 *
 * Shows the exact audio processing chain from source to output, with
 * technical details at each stage:
 *  - Source (file format, sample rate, bit depth from metadata)
 *  - HiFi EQ (4-band filter chain with current dB values)
 *  - Gain stage
 *  - Analyser (real-time spectrum)
 *  - Output (AudioContext destination)
 *
 * This mirrors Roon's "Signal Path" feature which audiophiles use to
 * verify their audio chain and DSP processing.
 */

interface SignalPathProps {
  /** Audio metadata for the currently playing track. */
  trackMetadata?: {
    container?: string
    audioCodec?: string
    sampleRate?: number
    channels?: number
    bitrate?: number
  }
  /** Current HiFi EQ state. */
  hifiEnabled?: boolean
  bassGain?: number
  midGain?: number
  trebleGain?: number
  presenceGain?: number
  /** AudioContext sample rate (the actual output rate). */
  outputSampleRate?: number
}

export function SignalPath({
  trackMetadata,
  hifiEnabled,
  bassGain = 0,
  midGain = 0,
  trebleGain = 0,
  presenceGain = 0,
  outputSampleRate,
}: SignalPathProps) {
  const stages = buildSignalPath({
    trackMetadata,
    hifiEnabled,
    bassGain,
    midGain,
    trebleGain,
    presenceGain,
    outputSampleRate,
  })

  return (
    <div className="rounded-xl bg-card/60 border border-border/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Waves className="w-4 h-4 text-[var(--accent)]" />
        <h4 className="text-sm font-bold">Signal Path</h4>
        <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-wider">
          {stages.length} stages
        </span>
      </div>
      {/* Horizontal chain */}
      <div className="flex items-stretch gap-1 overflow-x-auto rail-scroll pb-1">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center shrink-0">
            <StageCard stage={stage} />
            {i < stages.length - 1 && (
              <ArrowRight className="w-3 h-3 text-muted-foreground/50 mx-0.5 shrink-0" />
            )}
          </div>
        ))}
      </div>
      {/* Quality summary */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          Output:{' '}
          <span className="text-[var(--accent)] font-semibold">
            {formatSampleRate(outputSampleRate || trackMetadata?.sampleRate)}
          </span>
        </span>
        <span className="text-muted-foreground">
          {trackMetadata?.channels || 2} channel ·{' '}
          <span className={cn(hifiEnabled ? 'text-[var(--accent)]' : 'text-muted-foreground')}>
            {hifiEnabled ? 'HiFi DSP engaged' : 'Bit-perfect'}
          </span>
        </span>
      </div>
    </div>
  )
}

interface Stage {
  icon: typeof Disc3
  label: string
  detail: string
  active?: boolean
  accent?: boolean
}

function buildSignalPath(props: SignalPathProps): Stage[] {
  const stages: Stage[] = []
  const m = props.trackMetadata

  // 1. Source
  stages.push({
    icon: Disc3,
    label: 'Source',
    detail: [
      m?.container?.toUpperCase() || 'Unknown',
      m?.audioCodec?.toUpperCase(),
      formatSampleRate(m?.sampleRate),
      m?.bitrate ? `${Math.round(m.bitrate / 1000)} kbps` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    accent: true,
  })

  // 2. HiFi EQ stages (only if enabled)
  if (props.hifiEnabled) {
    const bands = [
      { name: 'Bass', freq: '200Hz', gain: props.bassGain },
      { name: 'Mid', freq: '1kHz', gain: props.midGain },
      { name: 'Treble', freq: '4kHz', gain: props.trebleGain },
      { name: 'Presence', freq: '8kHz', gain: props.presenceGain },
    ]
    for (const band of bands) {
      if (band.gain !== 0) {
        stages.push({
          icon: Sliders,
          label: `${band.name} EQ`,
          detail: `${band.freq} · ${band.gain > 0 ? '+' : ''}${band.gain} dB`,
          active: true,
        })
      }
    }
  }

  // 3. Gain
  stages.push({
    icon: Gauge,
    label: 'Gain',
    detail: 'Unity',
  })

  // 4. Analyser
  stages.push({
    icon: Waves,
    label: 'Analyser',
    detail: '512 FFT',
  })

  // 5. Output
  stages.push({
    icon: Speaker,
    label: 'Output',
    detail: formatSampleRate(props.outputSampleRate || m?.sampleRate),
    accent: true,
  })

  return stages
}

function StageCard({ stage }: { stage: Stage }) {
  const Icon = stage.icon
  return (
    <div
      className={cn(
        'rounded-lg border p-2 min-w-[80px] text-center',
        stage.accent
          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
          : stage.active
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-muted/30 border-border/40',
      )}
    >
      <Icon
        className={cn(
          'w-3.5 h-3.5 mx-auto mb-1',
          stage.accent
            ? 'text-[var(--accent)]'
            : stage.active
              ? 'text-amber-400'
              : 'text-muted-foreground',
        )}
      />
      <div className="text-[10px] font-semibold text-foreground">{stage.label}</div>
      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
        {stage.detail}
      </div>
    </div>
  )
}

function formatSampleRate(hz?: number): string {
  if (!hz) return 'Unknown'
  if (hz >= 1000) {
    const khz = hz / 1000
    return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`
  }
  return `${hz} Hz`
}
