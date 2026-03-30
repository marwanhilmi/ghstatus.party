import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const SEVERITY_COLOR: Record<number, string> = {
  0: 'bg-[#c77dff]', // purple (operational)
  1: 'bg-[#3b82f6]', // blue (maintenance)
  2: 'bg-[#ffd700]', // gold (minor)
  3: 'bg-[#ff6d94]', // hot pink (major)
}

const SEVERITY_LABEL: Record<number, string> = {
  0: 'Operational',
  1: 'Maintenance',
  2: 'Minor',
  3: 'Major',
}

const BAR_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatBarDate(index: number): string {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayMs = 86400000
  const rangeStart = new Date(today.getTime() - 89 * dayMs)
  const date = new Date(rangeStart.getTime() + index * dayMs)
  return BAR_DATE_FMT.format(date)
}

export function UptimeBars({ daySeverity }: { daySeverity: number[] }) {
  const [tooltip, setTooltip] = useState<{
    index: number
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const dayKeys = useMemo(() => {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const startMs = today.getTime() - 89 * 86400000
    return daySeverity.map((_, i) => new Date(startMs + i * 86400000).toISOString().slice(0, 10))
  }, [daySeverity])

  const handleMouseEnter = (index: number, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const barRect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({
      index,
      x: barRect.left - rect.left + barRect.width / 2,
      y: barRect.top - rect.top - 8,
    })
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-[#1a0a2e] px-3 py-1.5 text-xs text-[#f0e6ff] shadow-lg ring-1 ring-[rgba(199,125,255,0.3)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span className="font-medium">{formatBarDate(tooltip.index)}</span>
          <span className="ml-2 opacity-80">{SEVERITY_LABEL[daySeverity[tooltip.index]] ?? 'Operational'}</span>
        </div>
      )}

      {/* Bars */}
      <div className="flex items-end gap-[2px]" onMouseLeave={() => setTooltip(null)}>
        {daySeverity.map((severity, index) => (
          <span
            key={dayKeys[index]}
            className={cn(
              'h-8 min-w-[3px] flex-1 cursor-pointer rounded-sm transition-transform hover:scale-y-[1.3]',
              SEVERITY_COLOR[severity] ?? SEVERITY_COLOR[0],
            )}
            onMouseEnter={(e) => handleMouseEnter(index, e)}
          />
        ))}
      </div>

      {/* Range labels */}
      <div className="mt-1.5 flex justify-between text-xs text-[var(--sea-ink-soft)]">
        <span>90 days ago</span>
        <span>Today</span>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--sea-ink-soft)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c77dff]" />
          Operational
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
          Maintenance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ffd700]" />
          Minor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff6d94]" />
          Major
        </span>
      </div>
    </div>
  )
}
