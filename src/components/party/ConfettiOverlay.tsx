import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'

const PRINCE_COLORS = [
  '#9d4edd', // deep purple
  '#c77dff', // electric purple
  '#e0aaff', // lavender
  '#ff6d94', // hot pink
  '#ffd700', // gold
  '#f0e6ff', // white-purple
]

const YOUTUBE_VIDEO_ID = 'rblt2EtFfC4'

export function useConfetti() {
  const [active, setActive] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  const fireBurst = useCallback(async () => {
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: PRINCE_COLORS,
    })
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: PRINCE_COLORS,
    })
    setTimeout(() => {
      void confetti({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.5, y: 0.35 },
        colors: [...PRINCE_COLORS, '#ffd700', '#ffd700'],
      })
    }, 300)
    setTimeout(() => {
      void confetti({
        particleCount: 60,
        spread: 90,
        origin: { x: 0.3, y: 0.5 },
        colors: PRINCE_COLORS,
      })
      void confetti({
        particleCount: 60,
        spread: 90,
        origin: { x: 0.7, y: 0.5 },
        colors: PRINCE_COLORS,
      })
    }, 700)
  }, [])

  const fire = useCallback(() => {
    setActive(true)
    setShowVideo(true)

    void fireBurst()
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => void fireBurst(), 2500)
  }, [fireBurst])

  const stop = useCallback(() => {
    setActive(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const dismissVideo = useCallback(() => {
    setShowVideo(false)
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { active, showVideo, fire, stop, dismissVideo }
}

/** Floating confetti banner only — no modal */
export function ConfettiBanner({ active, uptime }: { active: boolean; uptime?: number }) {
  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center pt-8">
      <div className="animate-bounce rounded-2xl border border-[rgba(199,125,255,0.3)] bg-[rgba(13,2,33,0.9)] px-10 py-5 text-center shadow-[0_0_60px_rgba(157,78,221,0.4)] backdrop-blur-md">
        <p className="m-0 bg-gradient-to-r from-[#c77dff] via-[#ff6d94] to-[#ffd700] bg-clip-text text-3xl font-extrabold text-transparent">
          PARTY LIKE IT'S 89.99%
        </p>
        {uptime !== undefined && (
          <p className="m-0 mt-2 text-sm font-medium text-[#ffd700]">Uptime dropped to {uptime}%</p>
        )}
      </div>
    </div>
  )
}

/** Inline video card that sits in the dashboard flow */
export function VideoCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="island-shell relative overflow-hidden rounded-2xl p-5">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(157,78,221,0.12)] via-transparent to-[rgba(255,109,148,0.08)]" />

      <div className="relative">
        {/* Card header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[var(--kicker)]">Now Playing</h2>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6d94] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6d94]" />
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Video embed */}
        <div className="overflow-hidden rounded-xl">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
              title="Prince - 1999"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="bg-gradient-to-r from-[#c77dff] via-[#ff6d94] to-[#ffd700] bg-clip-text text-sm font-bold text-transparent">
            Prince - 1999
          </span>
        </div>
      </div>
    </div>
  )
}
