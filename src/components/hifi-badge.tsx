'use client'

/**
 * Animated HiFi badge — small equalizer bars that pulse to indicate
 * high-fidelity audio is engaged.
 */
export function HiFiBadge({
  active = true,
  className = '',
}: {
  active?: boolean
  className?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
        active
          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          : 'bg-white/5 text-white/40 border border-white/10'
      } ${className}`}
    >
      <span className="flex items-end gap-[2px] h-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-[2px] bg-current rounded-full ${
              active ? 'hifi-bar' : ''
            }`}
            style={{
              height: active ? undefined : '40%',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </span>
      HiFi
    </div>
  )
}
