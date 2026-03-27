import { Server } from 'partyserver'
import type { Connection, WSMessage } from 'partyserver'
import { nanoid } from 'nanoid'
import { generateName } from './names'
import { fetchAndComputeStatus } from './uptime-calculator'
import type { ChatMessage, ClientMessage, ServerMessage, StatusData } from './protocol'

const CONFETTI_THRESHOLD = 89.99
const FETCH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_RECENT_MESSAGES = 50

type ConnectionState = {
  name: string
}

export class StatusRoom extends Server<Env> {
  static options = { hibernate: true }

  cachedStatusData: StatusData | null = null
  recentMessages: ChatMessage[] = []

  async onStart() {
    // Schedule immediate data fetch
    await this.ctx.storage.setAlarm(Date.now() + 1000)
  }

  onConnect(connection: Connection<ConnectionState>) {
    const name = generateName()
    connection.setState({ name })

    // Send welcome message with current state
    const welcome: ServerMessage = {
      type: 'welcome',
      name,
      data: this.cachedStatusData,
      presence: this.getPresenceCount(),
      recentMessages: this.recentMessages,
    }
    connection.send(JSON.stringify(welcome))

    // Broadcast updated presence to everyone
    this.broadcastPresence()
  }

  onMessage(connection: Connection<ConnectionState>, message: WSMessage) {
    if (typeof message !== 'string') return

    let parsed: ClientMessage
    try {
      parsed = JSON.parse(message) as ClientMessage
    } catch {
      return
    }

    if (parsed.type === 'chat') {
      const text = parsed.text.trim()
      if (!text || text.length > 500) return

      const state = connection.state
      const chatMessage: ChatMessage = {
        id: nanoid(),
        sender: state?.name ?? 'Anonymous',
        text,
        timestamp: Date.now(),
      }

      // Store in recent messages buffer
      this.recentMessages.push(chatMessage)
      if (this.recentMessages.length > MAX_RECENT_MESSAGES) {
        this.recentMessages = this.recentMessages.slice(-MAX_RECENT_MESSAGES)
      }

      // Broadcast to all
      const msg: ServerMessage = { type: 'chat-message', message: chatMessage }
      this.broadcast(JSON.stringify(msg))
    }
  }

  onClose() {
    this.broadcastPresence()
  }

  async onAlarm() {
    try {
      const newData = await fetchAndComputeStatus()
      const oldUptime = this.cachedStatusData?.uptimePercent ?? null
      this.cachedStatusData = newData

      // Broadcast status update
      const update: ServerMessage = { type: 'status-update', data: newData }
      this.broadcast(JSON.stringify(update))

      // Check confetti trigger: uptime crossed below threshold
      if (newData.uptimePercent <= CONFETTI_THRESHOLD && (oldUptime === null || oldUptime > CONFETTI_THRESHOLD)) {
        const confetti: ServerMessage = {
          type: 'confetti-trigger',
          uptime: newData.uptimePercent,
        }
        this.broadcast(JSON.stringify(confetti))
      }
    } catch (err) {
      console.error('Failed to fetch status data:', err)
    }

    // Schedule next fetch
    await this.ctx.storage.setAlarm(Date.now() + FETCH_INTERVAL_MS)
  }

  async onRequest(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      return new Response(JSON.stringify(this.cachedStatusData), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('Method Not Allowed', { status: 405 })
  }

  private getPresenceCount(): number {
    let count = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.getConnections()) {
      count++
    }
    return count
  }

  private broadcastPresence() {
    const msg: ServerMessage = {
      type: 'presence',
      count: this.getPresenceCount(),
    }
    this.broadcast(JSON.stringify(msg))
  }
}
