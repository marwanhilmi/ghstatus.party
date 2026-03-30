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
    // Initialize messages table
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `)

    // Load recent messages from storage
    const rows = this.ctx.storage.sql
      .exec(`SELECT id, sender, text, timestamp FROM messages ORDER BY timestamp DESC LIMIT ${MAX_RECENT_MESSAGES}`)
      .toArray()
    this.recentMessages = rows
      .reverse()
      .map((row) => ({
        id: row.id as string,
        sender: row.sender as string,
        text: row.text as string,
        timestamp: row.timestamp as number,
      }))

    // Load cached status data
    this.cachedStatusData = (await this.ctx.storage.get<StatusData>('statusData')) ?? null

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

    // Trigger confetti for newcomers if uptime is already below threshold
    if (this.cachedStatusData && this.cachedStatusData.uptimePercent <= CONFETTI_THRESHOLD) {
      const confetti: ServerMessage = {
        type: 'confetti-trigger',
        uptime: this.cachedStatusData.uptimePercent,
      }
      connection.send(JSON.stringify(confetti))
    }

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

      // Persist to storage
      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, sender, text, timestamp) VALUES (?, ?, ?, ?)`,
        chatMessage.id,
        chatMessage.sender,
        chatMessage.text,
        chatMessage.timestamp,
      )
      // Trim old messages from storage
      this.ctx.storage.sql.exec(
        `DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY timestamp DESC LIMIT ${MAX_RECENT_MESSAGES})`,
      )

      // Update in-memory buffer
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
      await this.ctx.storage.put('statusData', newData)

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
