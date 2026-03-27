import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/party/protocol'
import { PresenceBadge } from './PresenceBadge'

const SENDER_COLORS = [
  'text-[#c77dff]', // electric purple
  'text-[#ff6d94]', // hot pink
  'text-[#ffd700]', // gold
  'text-[#e0aaff]', // lavender
  'text-[#ff9e64]', // warm amber
  'text-[#a78bfa]', // soft violet
  'text-[#f472b6]', // rose
  'text-[#60a5fa]', // cool blue
  'text-[#c084fc]', // orchid
  'text-[#fb923c]', // tangerine
]

function getSenderColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length]
}

export function ChatPanel({
  messages,
  presence,
  myName,
  onSend,
}: {
  messages: ChatMessage[]
  presence: number
  myName: string
  onSend: (text: string) => void
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Track if user has scrolled up
  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    shouldAutoScroll.current = nearBottom
  }

  // Auto-scroll on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <h3 className="m-0 text-sm font-semibold text-[var(--sea-ink)]">Chat</h3>
        <PresenceBadge count={presence} />
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-2">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-[var(--sea-ink-soft)]">No messages yet. Say something!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="py-1">
            <span className={`text-sm font-bold ${getSenderColor(msg.sender)}`}>{msg.sender}</span>
            <span className="text-sm text-[var(--sea-ink)]">: {msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[var(--line)] p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Chat as ${myName}...`}
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 rounded-lg bg-[var(--lagoon)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--lagoon-deep)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
