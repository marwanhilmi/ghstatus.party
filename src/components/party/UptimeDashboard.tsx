import { useEffect, useState } from 'react'
import type { StatusData } from '@/party/protocol'
import { UptimeBars } from './UptimeBars'

const IMPACT_BADGE: Record<string, string> = {
  none: 'bg-[rgba(199,125,255,0.15)] text-[#c77dff]',
  maintenance: 'bg-[rgba(59,130,246,0.15)] text-[#60a5fa]',
  minor: 'bg-[rgba(255,215,0,0.15)] text-[#ffd700]',
  major: 'bg-[rgba(255,109,148,0.15)] text-[#ff6d94]',
}

const IMPACT_LABEL: Record<string, string> = {
  none: 'Operational',
  maintenance: 'Maintenance',
  minor: 'Minor',
  major: 'Major',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function splitUptime(percent: number): { whole: string; decimal: string } {
  const str = percent.toFixed(2)
  const [whole, decimal] = str.split('.')
  return { whole, decimal }
}

function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="island-shell overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between bg-transparent px-5 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-[var(--sea-ink)]">{title}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--sea-ink-soft)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">{children}</div>}
    </div>
  )
}

const loadingSkeleton = (
  <div className="flex flex-1 items-center justify-center py-20">
    <div className="text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--lagoon)] border-t-transparent" />
      <p className="text-sm text-[var(--sea-ink-soft)]">Fetching GitHub status...</p>
    </div>
  </div>
)

function useLiveTick(intervalMs = 30_000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

export function UptimeDashboard({ data }: { data: StatusData | null }) {
  useLiveTick()

  if (!data) {
    return loadingSkeleton
  }

  const { whole, decimal } = splitUptime(data.uptimePercent)

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Hero countdown card */}
      <div className="island-shell relative overflow-hidden rounded-2xl p-6 sm:p-8">
        {/* Background glow effect */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(157,78,221,0.12)] via-transparent to-[rgba(255,109,148,0.08)]" />

        <div className="relative">
          {/* Title */}
          <div className="mb-6 flex items-center gap-3">
            <h2 className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[var(--kicker)]">GitHub Platform</h2>
            {/* Live pulse */}
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lagoon)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--lagoon)]" />
            </span>
          </div>

          {/* Big number - countdown style */}
          <div className="mb-6 flex items-baseline gap-1">
            <span className="bg-gradient-to-r from-[#c77dff] via-[#e0aaff] to-[#ffd700] bg-clip-text text-7xl font-extrabold leading-none tracking-tight text-transparent sm:text-8xl">
              {whole}
            </span>
            <span className="text-4xl font-bold text-[var(--sea-ink-soft)] sm:text-5xl">.{decimal}</span>
            <span className="ml-2 text-xl font-semibold text-[var(--sea-ink-soft)]">%</span>
          </div>

          {/* Subtitle */}
          <p className="m-0 mb-6 text-base text-[var(--sea-ink-soft)]">90-day uptime</p>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3.5 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Data updated {timeAgo(data.lastUpdated)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3.5 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lagoon)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--lagoon)]" />
              </span>
              Checked {timeAgo(data.lastFetched)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3.5 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)]">
              {data.incidentCount} incidents / 90 days
            </span>
            <a
              href="https://github.com/mrshu/github-statuses"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3.5 py-1.5 text-xs font-medium text-[var(--sea-ink-soft)] no-underline transition-opacity hover:opacity-80"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Source data
            </a>
          </div>
        </div>
      </div>

      {/* Collapsible: Uptime History */}
      <CollapsibleCard title="90-Day History" defaultOpen>
        <UptimeBars daySeverity={data.daySeverity} />
      </CollapsibleCard>

      {/* Collapsible: Recent Incidents */}
      {data.recentIncidents.length > 0 && (
        <CollapsibleCard title={`Recent Incidents (${data.recentIncidents.length})`}>
          <div className="flex flex-col gap-2">
            {data.recentIncidents.slice(0, 8).map((incident) => (
              <div
                key={incident.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--line)] bg-[rgba(30,10,60,0.3)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={incident.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-[var(--sea-ink)] no-underline hover:underline"
                  >
                    {incident.title}
                  </a>
                  <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">{incident.date}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${IMPACT_BADGE[incident.impact] ?? IMPACT_BADGE.none}`}
                >
                  {IMPACT_LABEL[incident.impact] ?? 'Operational'}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  )
}
