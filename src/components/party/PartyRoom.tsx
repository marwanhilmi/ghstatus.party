import { useCallback, useReducer } from 'react'
import { usePartySocket } from 'partysocket/react'
import type { ChatMessage, ServerMessage, ClientMessage, StatusData } from '@/party/protocol'
import { UptimeDashboard } from './UptimeDashboard'
import { ChatPanel } from './ChatPanel'
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
}

const initialState: RoomState = {
  statusData: null,
  messages: [],
  presence: 0,
  myName: 'Anonymous',
  confettiUptime: undefined,
  agentThinking: false,
  version: '',
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
  }
}

export function PartyRoom() {
  const [state, dispatch] = useReducer(roomReducer, initialState)
  const { active: confettiActive, showVideo, fire: fireConfetti, dismissVideo } = useConfetti()

  const socket = usePartySocket({
    party: 'status-room',
    room: 'main',
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

  const isDev = import.meta.env.DEV

  const handleTestConfetti = () => {
    dispatch({ type: 'confetti-trigger', uptime: 89.99 })
    fireConfetti()
  }

  return (
    <>
      <ConfettiBanner active={confettiActive} uptime={state.confettiUptime} />
      {state.version && <VersionIndicator version={state.version} />}
      <div className="flex h-screen flex-col gap-4 p-4 lg:flex-row">
        {/* Left: Uptime Dashboard + Video */}
        <div className="flex-[2] overflow-y-auto">
          <UptimeDashboard data={state.statusData} />

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
              <button
                type="button"
                onClick={handleTestConfetti}
                className="rounded-lg bg-[#9d4edd] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7b2cbf]"
              >
                Test 89.99% Confetti
              </button>
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
    </>
  )
}
