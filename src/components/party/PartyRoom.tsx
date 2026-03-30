import { useCallback, useState } from 'react'
import { usePartySocket } from 'partysocket/react'
import type { ChatMessage, ClientMessage, ServerMessage, StatusData } from '@/party/protocol'
import { UptimeDashboard } from './UptimeDashboard'
import { ChatPanel } from './ChatPanel'
import { ConfettiBanner, VideoCard, useConfetti } from './ConfettiOverlay'

const MAX_CLIENT_MESSAGES = 200

export function PartyRoom() {
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [presence, setPresence] = useState(0)
  const [myName, setMyName] = useState('Anonymous')
  const [confettiUptime, setConfettiUptime] = useState<number | undefined>()
  const { active: confettiActive, showVideo, fire: fireConfetti, dismissVideo } = useConfetti()

  const socket = usePartySocket({
    party: 'status-room',
    room: 'main',
    onMessage(evt) {
      const msg = JSON.parse(evt.data as string) as ServerMessage
      switch (msg.type) {
        case 'welcome':
          setMyName(msg.name)
          if (msg.data) setStatusData(msg.data)
          setPresence(msg.presence)
          setMessages(msg.recentMessages)
          break
        case 'status-update':
          setStatusData(msg.data)
          break
        case 'chat-message':
          setMessages((prev) => [...prev, msg.message].slice(-MAX_CLIENT_MESSAGES))
          break
        case 'presence':
          setPresence(msg.count)
          break
        case 'confetti-trigger':
          setConfettiUptime(msg.uptime)
          fireConfetti()
          break
      }
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
    setConfettiUptime(89.99)
    fireConfetti()
  }

  return (
    <>
      <ConfettiBanner active={confettiActive} uptime={confettiUptime} />
      <div className="flex h-screen flex-col gap-4 p-4 lg:flex-row">
        {/* Left: Uptime Dashboard + Video */}
        <div className="flex-[2] overflow-y-auto">
          <UptimeDashboard data={statusData} />

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
          <ChatPanel messages={messages} presence={presence} myName={myName} onSend={handleSend} />
        </div>
      </div>
    </>
  )
}
