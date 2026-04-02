import { useState } from 'react'
import { Coins, Trophy } from 'lucide-react'
import type { Market, BetPosition, LeaderboardEntry } from '@/party/protocol'
import { MarketCard } from './MarketCard'

const MEDALS = ['#ffd700', '#c0c0c0', '#cd7f32'] // gold, silver, bronze

export function BettingPanel({
  markets,
  balance,
  positions,
  leaderboard,
  onPlaceBet,
}: {
  markets: Market[]
  balance: number
  positions: BetPosition[]
  leaderboard: LeaderboardEntry[]
  onPlaceBet: (marketId: string, side: 'yes' | 'no', amount: number) => void
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const openMarkets = markets.filter((m) => m.status === 'open')
  const resolvedMarkets = markets.filter((m) => m.status !== 'open').slice(-3)

  if (openMarkets.length === 0 && resolvedMarkets.length === 0) return null

  return (
    <div className="island-shell overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-[var(--kicker)]">Predictions</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.08)] px-2.5 py-0.5 text-xs font-bold text-[#ffd700]">
            <Coins size={12} />
            {balance.toLocaleString()}
          </span>
        </div>
        {leaderboard.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            <Trophy size={12} />
            Top bettors
          </button>
        )}
      </div>

      <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
        {/* Leaderboard */}
        {showLeaderboard && leaderboard.length > 0 && (
          <div className="mb-4 rounded-xl border border-[var(--line)] bg-[rgba(30,10,60,0.3)] p-3">
            <div className="flex flex-col gap-1.5">
              {leaderboard.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {i < 3 ? (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                        style={{ color: MEDALS[i] }}
                      >
                        {i + 1}
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center text-[var(--sea-ink-soft)]">
                        {i + 1}
                      </span>
                    )}
                    <span className="font-medium text-[var(--sea-ink)]">{entry.name}</span>
                  </div>
                  <span className="font-bold text-[#ffd700]">+{entry.totalWon.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open markets */}
        <div className="flex flex-col gap-3">
          {openMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              position={positions.find((p) => p.marketId === market.id)}
              balance={balance}
              onPlaceBet={onPlaceBet}
            />
          ))}
        </div>

        {/* Recently resolved */}
        {resolvedMarkets.length > 0 && (
          <div className="mt-4">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Recently Resolved
            </p>
            <div className="flex flex-col gap-2">
              {resolvedMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  position={positions.find((p) => p.marketId === market.id)}
                  balance={balance}
                  onPlaceBet={onPlaceBet}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
