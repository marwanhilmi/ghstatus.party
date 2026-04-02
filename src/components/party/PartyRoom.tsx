import { useCallback, useReducer } from 'react'
import { usePartySocket } from 'partysocket/react'
import type {
  ChatMessage,
  ServerMessage,
  ClientMessage,
  StatusData,
  Market,
  BetPosition,
  LeaderboardEntry,
} from '@/party/protocol'
import { useBettorId } from '#/hooks/useBettorId'
import { UptimeDashboard } from './UptimeDashboard'
import { ChatPanel } from './ChatPanel'
import { BettingPanel } from './BettingPanel'
import { ConfettiBanner, VideoCard, useConfetti } from './ConfettiOverlay'
import { VersionIndicator } from './VersionIndicator'

const MAX_CLIENT_MESSAGES = 200

type RoomState = {
  statusData: StatusData | null
  messages: ChatMessage[]
  presence: number
  myName: string
  confettiUptime: number | undefined
  agentThinking: boolean
  version: string
  markets: Market[]
  balance: number
  positions: BetPosition[]
  leaderboard: LeaderboardEntry[]
}

const initialState: RoomState = {
  statusData: null,
  messages: [],
  presence: 0,
  myName: 'Anonymous',
  confettiUptime: undefined,
  agentThinking: false,
  version: '',
  markets: [],
  balance: 1000,
  positions: [],
  leaderboard: [],
}

function roomReducer(state: RoomState, action: ServerMessage): RoomState {
  switch (action.type) {
    case 'welcome':
      return {
        ...state,
        myName: action.name,
        statusData: action.data ?? state.statusData,
        presence: action.presence,
        messages: action.recentMessages,
        version: action.version,
      }
    case 'status-update':
      return { ...state, statusData: action.data }
    case 'chat-message':
      return {
        ...state,
        messages: [...state.messages, action.message].slice(-MAX_CLIENT_MESSAGES),
        agentThinking: action.message.isAgent ? false : state.agentThinking,
      }
    case 'agent-thinking':
      return { ...state, agentThinking: true }
    case 'presence':
      return { ...state, presence: action.count }
    case 'confetti-trigger':
      return { ...state, confettiUptime: action.uptime }
    case 'message-deleted':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) }
    case 'message-edited':
      return { ...state, messages: state.messages.map((m) => (m.id === action.message.id ? action.message : m)) }
    case 'betting-sync':
      return {
        ...state,
        markets: action.markets,
        balance: action.balance,
        positions: action.positions,
        leaderboard: action.leaderboard,
      }
    case 'market-update': {
      const exists = state.markets.some((m) => m.id === action.market.id)
      return {
        ...state,
        markets: exists
          ? state.markets.map((m) => (m.id === action.market.id ? action.market : m))
          : [...state.markets, action.market],
      }
    }
    case 'market-resolved':
      return { ...state, markets: state.markets.map((m) => (m.id === action.market.id ? action.market : m)) }
    case 'balance-update':
      return { ...state, balance: action.balance }
    case 'bet-confirmed':
      return {
        ...state,
        positions: [...state.positions, action.position],
        markets: state.markets.map((m) => (m.id === action.market.id ? action.market : m)),
        balance: action.balance,
      }
    case 'bet-error':
      return state
  }
}

export function PartyRoom() {
  const [state, dispatch] = useReducer(roomReducer, initialState)
  const { active: confettiActive, showVideo, fire: fireConfetti, dismissVideo } = useConfetti()
  const bettorId = useBettorId()

  const socket = usePartySocket({
    party: 'status-room',
    room: 'main',
    query: { bettorId },
    onMessage(evt) {
      const msg = JSON.parse(evt.data as string) as ServerMessage
      dispatch(msg)
      if (msg.type === 'confetti-trigger') fireConfetti()
    },
  })

  const handleSend = useCallback(
    (text: string) => {
      const msg: ClientMessage = { type: 'chat', text }
      socket.send(JSON.stringify(msg))
    },
    [socket],
  )

  const handlePlaceBet = useCallback(
    (marketId: string, side: 'yes' | 'no', amount: number) => {
      const msg: ClientMessage = { type: 'place-bet', marketId, side, amount }
      socket.send(JSON.stringify(msg))
    },
    [socket],
  )

  const isDev = import.meta.env.DEV

  const handleTestConfetti = () => {
    dispatch({ type: 'confetti-trigger', uptime: 89.99 })
    fireConfetti()
  }

  const handleTestMarkets = () => {
    const msg: ClientMessage = { type: 'create-test-markets' }
    socket.send(JSON.stringify(msg))
  }

  const handleResolveMarkets = () => {
    const msg: ClientMessage = { type: 'resolve-test-markets' }
    socket.send(JSON.stringify(msg))
  }

  return (
    <>
      <ConfettiBanner active={confettiActive} uptime={state.confettiUptime} />
      <div className="flex h-[100dvh] flex-col p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {/* Left: Uptime Dashboard + Video */}
          <div className="flex-[2] overflow-y-auto">
            <UptimeDashboard data={state.statusData} />

            {/* Prediction market */}
            <div className="mt-4">
              <BettingPanel
                markets={state.markets}
                balance={state.balance}
                positions={state.positions}
                leaderboard={state.leaderboard}
                onPlaceBet={handlePlaceBet}
              />
            </div>

            {/* Video card — inline below the hero */}
            {showVideo && (
              <div className="mt-4">
                <VideoCard onDismiss={dismissVideo} />
              </div>
            )}

            {isDev && (
              <div className="mt-4 island-shell rounded-2xl p-4">
                <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                  Dev Tools
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTestConfetti}
                    className="rounded-lg bg-[#9d4edd] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7b2cbf]"
                  >
                    Test Confetti
                  </button>
                  <button
                    type="button"
                    onClick={handleTestMarkets}
                    className="rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-semibold text-[#1a1a2e] transition hover:bg-[#e6c200]"
                  >
                    Create Test Markets
                  </button>
                  <button
                    type="button"
                    onClick={handleResolveMarkets}
                    className="rounded-lg bg-[#ff6d94] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e0557f]"
                  >
                    Force Resolve All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Chat */}
          <div className="min-h-[400px] flex-1 lg:min-h-0">
            <ChatPanel
              messages={state.messages}
              presence={state.presence}
              myName={state.myName}
              onSend={handleSend}
              agentThinking={state.agentThinking}
            />
          </div>
        </div>

        {/* Footer */}
        {state.version && <VersionIndicator version={state.version} />}
      </div>
    </>
  )
}
