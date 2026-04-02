import { useState } from 'react'
import { Popover } from 'radix-ui'
import type { Market, BetPosition } from '@/party/protocol'

const QUICK_AMOUNTS = [10, 50, 100]

function formatTimeLeft(resolveAt: number): string {
  const diff = resolveAt - Date.now()
  if (diff <= 0) return 'Resolving...'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff / (1000 * 60)) % 60)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h left`
  }
  return `${hours}h ${mins}m left`
}

export function MarketCard({
  market,
  position,
  balance,
  onPlaceBet,
}: {
  market: Market
  position: BetPosition | undefined
  balance: number
  onPlaceBet: (marketId: string, side: 'yes' | 'no', amount: number) => void
}) {
  const totalPool = market.poolYes + market.poolNo
  const yesPct = totalPool > 0 ? Math.round((market.poolYes / totalPool) * 100) : 50
  const noPct = 100 - yesPct
  const isOpen = market.status === 'open'
  const isResolved = market.status === 'resolved_yes' || market.status === 'resolved_no'

  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[rgba(30,10,60,0.3)] p-4 ${isResolved ? 'opacity-60' : ''}`}
    >
      {/* Question */}
      <p className="m-0 mb-3 text-sm font-semibold text-[var(--sea-ink)]">{market.question}</p>

      {/* Pool bar */}
      <div className="mb-3 flex h-6 overflow-hidden rounded-full">
        <div
          className="flex items-center justify-center bg-[#9d4edd] text-xs font-bold text-white transition-all duration-300"
          style={{ width: `${yesPct}%` }}
        >
          {yesPct > 15 && `${yesPct}%`}
        </div>
        <div
          className="flex items-center justify-center bg-[#ff6d94] text-xs font-bold text-white transition-all duration-300"
          style={{ width: `${noPct}%` }}
        >
          {noPct > 15 && `${noPct}%`}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2">
        {isOpen && !position ? (
          <div className="flex gap-2">
            <BetButton side="yes" label={`Yes ${yesPct}%`} market={market} balance={balance} onPlaceBet={onPlaceBet} />
            <BetButton side="no" label={`No ${noPct}%`} market={market} balance={balance} onPlaceBet={onPlaceBet} />
          </div>
        ) : isOpen && position ? (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(157,78,221,0.08)] px-3 py-1.5 text-xs text-[var(--sea-ink-soft)]">
            Your bet: <span className="font-semibold text-[#ffd700]">{position.amount}</span> on{' '}
            <span className="font-semibold">{position.side.toUpperCase()}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#ffd700]">
              Resolved: {market.status === 'resolved_yes' ? 'YES' : 'NO'}
            </span>
            {position && position.payout != null && position.payout > 0 && (
              <span className="text-xs font-semibold text-[#ffd700]">— Won {position.payout}!</span>
            )}
          </div>
        )}

        <span className="text-xs text-[var(--sea-ink-soft)]">
          {isOpen ? formatTimeLeft(market.resolveAt) : `${totalPool} pool`}
        </span>
      </div>
    </div>
  )
}

function BetButton({
  side,
  label,
  market,
  balance,
  onPlaceBet,
}: {
  side: 'yes' | 'no'
  label: string
  market: Market
  balance: number
  onPlaceBet: (marketId: string, side: 'yes' | 'no', amount: number) => void
}) {
  const [amount, setAmount] = useState(10)
  const [open, setOpen] = useState(false)

  const totalPool = market.poolYes + market.poolNo + amount
  const winningPool = (side === 'yes' ? market.poolYes : market.poolNo) + amount
  const potentialPayout = winningPool > 0 ? Math.floor(amount * (totalPool / winningPool)) : 0

  const handleBet = () => {
    if (amount >= 10 && amount <= balance) {
      onPlaceBet(market.id, side, amount)
      setOpen(false)
      setAmount(10)
    }
  }

  const bgClass = side === 'yes' ? 'bg-[#9d4edd] hover:bg-[#7b2cbf]' : 'bg-[#ff6d94] hover:bg-[#e0557f]'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${bgClass}`}
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-56 rounded-xl border border-[var(--line)] bg-[var(--bg-base)] p-4 shadow-xl"
          sideOffset={5}
          align="start"
        >
          <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
            Bet {side.toUpperCase()}
          </p>

          {/* Quick amounts */}
          <div className="mb-2 flex gap-1.5">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                  amount === q
                    ? 'border-[#ffd700] bg-[rgba(255,215,0,0.1)] text-[#ffd700]'
                    : 'border-[var(--line)] text-[var(--sea-ink-soft)] hover:border-[var(--sea-ink-soft)]'
                }`}
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(balance)}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs font-bold transition ${
                amount === balance
                  ? 'border-[#ffd700] bg-[rgba(255,215,0,0.15)] text-[#ffd700]'
                  : 'border-[var(--line)] text-[#ffd700] hover:border-[#ffd700]'
              }`}
            >
              ALL
            </button>
          </div>

          {/* Custom amount input */}
          <input
            type="number"
            min={10}
            max={balance}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="mb-2 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm text-[var(--sea-ink)] outline-none focus:border-[#9d4edd]"
          />

          {/* Payout preview */}
          <p className="m-0 mb-3 text-xs text-[var(--sea-ink-soft)]">
            Potential payout: <span className="font-semibold text-[#ffd700]">{potentialPayout}</span>
          </p>

          {/* Place bet */}
          <button
            type="button"
            onClick={handleBet}
            disabled={amount < 10 || amount > balance}
            className={`w-full rounded-lg py-2 text-sm font-bold text-white transition ${bgClass} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Place Bet
          </button>

          <Popover.Arrow className="fill-[var(--bg-base)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
