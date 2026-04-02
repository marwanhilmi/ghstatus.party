import { Server } from 'partyserver'
import type { Connection, WSMessage } from 'partyserver'
import { nanoid } from 'nanoid'
import { generateName } from './names'
import { fetchAndComputeStatus } from './uptime-calculator'
import type {
  ChatMessage,
  ClientMessage,
  ServerMessage,
  StatusData,
  Market,
  BetPosition,
  LeaderboardEntry,
} from './protocol'

const CONFETTI_THRESHOLD = 89.99
const FETCH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_RECENT_MESSAGES = 50
const STARTING_BALANCE = 1000
const MIN_BET = 10
const SEED_POOL = 100 // phantom coins per side
const MIN_OPEN_MARKETS = 3

type ConnectionState = {
  name: string
  bettorId: string | null
}

type MarketTemplate = {
  question: (uptime: number) => string
  kind: string
  thresholdFn: (uptime: number) => number
  comparison: 'above' | 'below'
  durationMs: number
}

const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    question: (uptime) => `Will uptime stay above ${(uptime - 0.01).toFixed(2)}% by tomorrow?`,
    kind: 'daily-uptime',
    thresholdFn: (uptime) => Number((uptime - 0.01).toFixed(2)),
    comparison: 'above',
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    question: () => `Will there be a major incident in the next 24 hours?`,
    kind: 'incident-today',
    thresholdFn: () => 3,
    comparison: 'above',
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    question: (uptime) => `Will uptime drop below ${(uptime - 0.05).toFixed(2)}% this week?`,
    kind: 'weekly-uptime',
    thresholdFn: (uptime) => Number((uptime - 0.05).toFixed(2)),
    comparison: 'below',
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
]

export class StatusRoom extends Server<Env> {
  static options = { hibernate: true }

  cachedStatusData: StatusData | null = null
  recentMessages: ChatMessage[] = []

  async onStart() {
    // Initialize tables
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS bettors (
        id TEXT PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT ${STARTING_BALANCE},
        total_won INTEGER NOT NULL DEFAULT 0,
        total_wagered INTEGER NOT NULL DEFAULT 0,
        last_known_name TEXT NOT NULL DEFAULT 'Anonymous',
        created_at INTEGER NOT NULL
      )
    `)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        kind TEXT NOT NULL,
        threshold REAL,
        comparison TEXT NOT NULL,
        baseline_value REAL,
        pool_yes INTEGER NOT NULL DEFAULT ${SEED_POOL},
        pool_no INTEGER NOT NULL DEFAULT ${SEED_POOL},
        status TEXT NOT NULL DEFAULT 'open',
        resolve_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      )
    `)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS bets (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        bettor_id TEXT NOT NULL,
        side TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payout INTEGER,
        created_at INTEGER NOT NULL
      )
    `)

    // Load recent messages from storage
    const rows = this.ctx.storage.sql
      .exec(`SELECT id, sender, text, timestamp FROM messages ORDER BY timestamp DESC LIMIT ${MAX_RECENT_MESSAGES}`)
      .toArray()
    this.recentMessages = rows.reverse().map((row) => ({
      id: row.id as string,
      sender: row.sender as string,
      text: row.text as string,
      timestamp: row.timestamp as number,
      ...(row.sender === 'StatusBot' ? { isAgent: true } : {}),
    }))

    // Load cached status data
    this.cachedStatusData = (await this.ctx.storage.get<StatusData>('statusData')) ?? null

    // Schedule immediate data fetch
    await this.ctx.storage.setAlarm(Date.now() + 1000)
  }

  onConnect(connection: Connection<ConnectionState>) {
    const name = generateName()

    // Extract bettorId from URL query params
    const url = new URL(connection.uri ?? '', 'http://dummy')
    const bettorId = url.searchParams.get('bettorId') || null

    connection.setState({ name, bettorId })

    // Upsert bettor row
    if (bettorId) {
      this.ctx.storage.sql.exec(
        `INSERT INTO bettors (id, last_known_name, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET last_known_name = ?`,
        bettorId,
        name,
        Date.now(),
        name,
      )
    }

    // Send welcome message with current state
    const versionId = (this.env as Record<string, any>).CF_VERSION_METADATA?.id ?? 'dev'
    const welcome: ServerMessage = {
      type: 'welcome',
      name,
      data: this.cachedStatusData,
      presence: this.getPresenceCount(),
      recentMessages: this.recentMessages,
      version: versionId,
    }
    connection.send(JSON.stringify(welcome))

    // Send betting sync
    if (bettorId) {
      this.sendBettingSync(connection)
    }

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

    if (parsed.type === 'place-bet') {
      this.handlePlaceBet(connection, parsed)
      return
    }

    if (parsed.type === 'create-test-markets') {
      this.createTestMarkets(connection)
      return
    }

    if (parsed.type === 'resolve-test-markets') {
      this.resolveExpiredMarkets(true)
      // Resync everyone
      for (const conn of this.getConnections<ConnectionState>()) {
        this.sendBettingSync(conn)
      }
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

      this.persistAndBroadcast(chatMessage)

      // 🎉 in chat re-triggers confetti for everyone
      if (text.includes('🎉')) {
        const confetti: ServerMessage = {
          type: 'confetti-trigger',
          uptime: this.cachedStatusData?.uptimePercent ?? 0,
        }
        this.broadcast(JSON.stringify(confetti))
      }

      // Check for @statusbot mention (behind ENABLE_AGENT flag)
      if (this.env.ENABLE_AGENT) {
        const statusbotMatch = text.match(/^@statusbot\s+/i)
        if (statusbotMatch) {
          const question = text.slice(statusbotMatch[0].length).trim()
          if (question) {
            void this.handleAgentQuestion(question)
          }
        }
      }
    }
  }

  private async handleAgentQuestion(question: string) {
    // Broadcast thinking indicator
    const thinking: ServerMessage = { type: 'agent-thinking' }
    this.broadcast(JSON.stringify(thinking))

    try {
      const id = this.env.DowntimeAgent.idFromName('main')
      const stub = this.env.DowntimeAgent.get(id)
      const response = await stub.fetch('https://agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, statusData: this.cachedStatusData }),
      })

      const body = (await response.json()) as { answer: string }
      const answer = body.answer || 'No response from AI model.'

      const agentMessage: ChatMessage = {
        id: nanoid(),
        sender: 'StatusBot',
        text: answer,
        timestamp: Date.now(),
        isAgent: true,
      }

      this.persistAndBroadcast(agentMessage)
    } catch (err) {
      console.error('Agent error:', err)

      const errorMessage: ChatMessage = {
        id: nanoid(),
        sender: 'StatusBot',
        text: "Sorry, I couldn't process that question right now. Try again in a moment!",
        timestamp: Date.now(),
        isAgent: true,
      }

      this.persistAndBroadcast(errorMessage)
    }
  }

  private persistAndBroadcast(chatMessage: ChatMessage) {
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

  onClose() {
    this.broadcastPresence()
  }

  async onAlarm() {
    try {
      const newData = await fetchAndComputeStatus()
      newData.lastFetched = new Date().toISOString()
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

    // Resolve expired markets and ensure enough open ones exist
    this.resolveExpiredMarkets()
    this.ensureActiveMarkets()

    // Schedule next fetch
    await this.ctx.storage.setAlarm(Date.now() + FETCH_INTERVAL_MS)
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname.endsWith('/messages')) {
      const secret = this.env.ADMIN_SECRET
      if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
        return new Response('Unauthorized', { status: 401 })
      }
      return Response.json(this.recentMessages)
    }

    if (request.method === 'GET') {
      return Response.json(this.cachedStatusData)
    }

    // Admin endpoints: DELETE /messages/:id, PATCH /messages/:id
    const messageMatch = url.pathname.match(/\/messages\/([^/]+)$/)
    if (messageMatch && (request.method === 'DELETE' || request.method === 'PATCH')) {
      const secret = this.env.ADMIN_SECRET
      if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
        return new Response('Unauthorized', { status: 401 })
      }

      const messageId = messageMatch[1]

      if (request.method === 'DELETE') {
        this.ctx.storage.sql.exec(`DELETE FROM messages WHERE id = ?`, messageId)
        this.recentMessages = this.recentMessages.filter((m) => m.id !== messageId)
        const msg: ServerMessage = { type: 'message-deleted', id: messageId }
        this.broadcast(JSON.stringify(msg))
        return Response.json({ ok: true })
      }

      if (request.method === 'PATCH') {
        const body = (await request.json()) as { text: string }
        const text = body.text?.trim()
        if (!text) return new Response('Missing text', { status: 400 })

        this.ctx.storage.sql.exec(`UPDATE messages SET text = ? WHERE id = ?`, text, messageId)
        const existing = this.recentMessages.find((m) => m.id === messageId)
        if (existing) existing.text = text
        const edited: ChatMessage = existing ?? { id: messageId, sender: '', text, timestamp: 0 }
        const msg: ServerMessage = { type: 'message-edited', message: edited }
        this.broadcast(JSON.stringify(msg))
        return Response.json({ ok: true })
      }
    }

    return new Response('Not Found', { status: 404 })
  }

  private handlePlaceBet(
    connection: Connection<ConnectionState>,
    msg: { marketId: string; side: 'yes' | 'no'; amount: number },
  ) {
    const bettorId = connection.state?.bettorId
    if (!bettorId) {
      connection.send(JSON.stringify({ type: 'bet-error', message: 'No bettor identity' } satisfies ServerMessage))
      return
    }

    const { marketId, side, amount } = msg
    if (amount < MIN_BET) {
      connection.send(
        JSON.stringify({ type: 'bet-error', message: `Minimum bet is ${MIN_BET} GitCoins` } satisfies ServerMessage),
      )
      return
    }

    // Check market is open
    const marketRows = this.ctx.storage.sql
      .exec(`SELECT * FROM markets WHERE id = ? AND status = 'open'`, marketId)
      .toArray()
    if (marketRows.length === 0) {
      connection.send(
        JSON.stringify({ type: 'bet-error', message: 'Market not found or closed' } satisfies ServerMessage),
      )
      return
    }

    // Check balance
    const bettorRows = this.ctx.storage.sql.exec(`SELECT balance FROM bettors WHERE id = ?`, bettorId).toArray()
    const balance = (bettorRows[0]?.balance as number) ?? 0
    if (balance < amount) {
      connection.send(JSON.stringify({ type: 'bet-error', message: 'Insufficient GitCoins' } satisfies ServerMessage))
      return
    }

    // Deduct balance
    this.ctx.storage.sql.exec(
      `UPDATE bettors SET balance = balance - ?, total_wagered = total_wagered + ? WHERE id = ?`,
      amount,
      amount,
      bettorId,
    )

    // Insert bet
    const betId = nanoid()
    this.ctx.storage.sql.exec(
      `INSERT INTO bets (id, market_id, bettor_id, side, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      betId,
      marketId,
      bettorId,
      side,
      amount,
      Date.now(),
    )

    // Update market pool
    const poolCol = side === 'yes' ? 'pool_yes' : 'pool_no'
    this.ctx.storage.sql.exec(`UPDATE markets SET ${poolCol} = ${poolCol} + ? WHERE id = ?`, amount, marketId)

    // Read updated market
    const updatedMarket = this.readMarket(marketId)!
    const newBalance =
      (this.ctx.storage.sql.exec(`SELECT balance FROM bettors WHERE id = ?`, bettorId).toArray()[0]
        ?.balance as number) ?? 0

    const position: BetPosition = { marketId, side, amount, payout: null }

    // Send confirmation to bettor
    connection.send(
      JSON.stringify({
        type: 'bet-confirmed',
        position,
        market: updatedMarket,
        balance: newBalance,
      } satisfies ServerMessage),
    )

    // Broadcast updated market to everyone
    const marketUpdate: ServerMessage = { type: 'market-update', market: updatedMarket }
    this.broadcast(JSON.stringify(marketUpdate))

    // Announce big bets in chat (100+ coins)
    if (amount >= 100) {
      const name = connection.state?.name ?? 'Anonymous'
      const sideLabel = side.toUpperCase()
      const isAllIn = newBalance === 0
      const text = isAllIn
        ? `${name} went ALL IN (${amount}) on ${sideLabel} — "${updatedMarket.question}"`
        : `${name} bet ${amount} on ${sideLabel} — "${updatedMarket.question}"`
      this.persistAndBroadcast({
        id: nanoid(),
        sender: 'StatusBot',
        text,
        timestamp: Date.now(),
        isAgent: true,
      })
    }
  }

  private sendBettingSync(connection: Connection<ConnectionState>) {
    const bettorId = connection.state?.bettorId
    if (!bettorId) return

    const markets = this.getOpenMarkets()
    const bettorRows = this.ctx.storage.sql.exec(`SELECT balance FROM bettors WHERE id = ?`, bettorId).toArray()
    const balance = (bettorRows[0]?.balance as number) ?? STARTING_BALANCE
    const positions = this.getBettorPositions(bettorId)
    const leaderboard = this.getLeaderboard()

    const sync: ServerMessage = { type: 'betting-sync', markets, balance, positions, leaderboard }
    connection.send(JSON.stringify(sync))
  }

  private getOpenMarkets(): Market[] {
    const rows = this.ctx.storage.sql
      .exec(`SELECT * FROM markets WHERE status = 'open' ORDER BY resolve_at ASC`)
      .toArray()
    return rows.map((r) => this.rowToMarket(r))
  }

  private readMarket(id: string): Market | null {
    const rows = this.ctx.storage.sql.exec(`SELECT * FROM markets WHERE id = ?`, id).toArray()
    if (rows.length === 0) return null
    return this.rowToMarket(rows[0])
  }

  private rowToMarket(r: Record<string, unknown>): Market {
    return {
      id: r.id as string,
      question: r.question as string,
      kind: r.kind as string,
      poolYes: r.pool_yes as number,
      poolNo: r.pool_no as number,
      status: r.status as Market['status'],
      resolveAt: r.resolve_at as number,
      createdAt: r.created_at as number,
    }
  }

  private getBettorPositions(bettorId: string): BetPosition[] {
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT market_id, side, SUM(amount) as amount, SUM(COALESCE(payout, 0)) as payout
         FROM bets WHERE bettor_id = ? GROUP BY market_id, side`,
        bettorId,
      )
      .toArray()
    return rows.map((r) => ({
      marketId: r.market_id as string,
      side: r.side as 'yes' | 'no',
      amount: r.amount as number,
      payout: r.payout as number | null,
    }))
  }

  private getLeaderboard(): LeaderboardEntry[] {
    const rows = this.ctx.storage.sql
      .exec(`SELECT last_known_name, total_won FROM bettors WHERE total_won > 0 ORDER BY total_won DESC LIMIT 5`)
      .toArray()
    return rows.map((r) => ({
      name: r.last_known_name as string,
      totalWon: r.total_won as number,
    }))
  }

  private resolveExpiredMarkets(force = false) {
    const now = Date.now()
    const expired = force
      ? this.ctx.storage.sql.exec(`SELECT * FROM markets WHERE status = 'open'`).toArray()
      : this.ctx.storage.sql.exec(`SELECT * FROM markets WHERE status = 'open' AND resolve_at <= ?`, now).toArray()

    for (const row of expired) {
      const marketId = row.id as string
      const kind = row.kind as string
      const threshold = row.threshold as number
      const comparison = row.comparison as string

      let outcome: 'yes' | 'no' = 'no'

      if (this.cachedStatusData) {
        if (kind === 'daily-uptime' || kind === 'weekly-uptime') {
          const current = this.cachedStatusData.uptimePercent
          if (comparison === 'above') outcome = current > threshold ? 'yes' : 'no'
          else outcome = current < threshold ? 'yes' : 'no'
        } else if (kind === 'incident-today') {
          const todaySeverity = this.cachedStatusData.daySeverity[this.cachedStatusData.daySeverity.length - 1] ?? 0
          outcome = todaySeverity >= threshold ? 'yes' : 'no'
        }
      }

      const status = outcome === 'yes' ? 'resolved_yes' : 'resolved_no'
      this.ctx.storage.sql.exec(`UPDATE markets SET status = ?, resolved_at = ? WHERE id = ?`, status, now, marketId)

      const poolYes = row.pool_yes as number
      const poolNo = row.pool_no as number
      const totalPool = poolYes + poolNo
      const winningPool = outcome === 'yes' ? poolYes : poolNo

      // Calculate payouts for winning bets
      if (winningPool > 0) {
        const winningBets = this.ctx.storage.sql
          .exec(`SELECT id, bettor_id, amount FROM bets WHERE market_id = ? AND side = ?`, marketId, outcome)
          .toArray()

        for (const bet of winningBets) {
          const payout = Math.floor((bet.amount as number) * (totalPool / winningPool))
          this.ctx.storage.sql.exec(`UPDATE bets SET payout = ? WHERE id = ?`, payout, bet.id as string)
          this.ctx.storage.sql.exec(
            `UPDATE bettors SET balance = balance + ?, total_won = total_won + ? WHERE id = ?`,
            payout,
            payout - (bet.amount as number),
            bet.bettor_id as string,
          )
        }
      }

      // Broadcast resolution to each connection with personalized payout
      const resolvedMarket = this.readMarket(marketId)!
      for (const conn of this.getConnections<ConnectionState>()) {
        const connBettorId = conn.state?.bettorId
        let yourPayout: number | null = null
        if (connBettorId) {
          const payoutRows = this.ctx.storage.sql
            .exec(
              `SELECT SUM(payout) as total_payout FROM bets WHERE market_id = ? AND bettor_id = ? AND side = ?`,
              marketId,
              connBettorId,
              outcome,
            )
            .toArray()
          yourPayout = (payoutRows[0]?.total_payout as number) ?? null
        }
        const msg: ServerMessage = { type: 'market-resolved', market: resolvedMarket, yourPayout }
        conn.send(JSON.stringify(msg))

        // Send updated balance
        if (connBettorId) {
          const balRows = this.ctx.storage.sql.exec(`SELECT balance FROM bettors WHERE id = ?`, connBettorId).toArray()
          const balance = (balRows[0]?.balance as number) ?? 0
          conn.send(JSON.stringify({ type: 'balance-update', balance } satisfies ServerMessage))
        }
      }

      // Announce resolution in chat
      const question = row.question as string
      const outcomeLabel = outcome.toUpperCase()
      const winnerCount = this.ctx.storage.sql
        .exec(`SELECT COUNT(DISTINCT bettor_id) as cnt FROM bets WHERE market_id = ? AND side = ?`, marketId, outcome)
        .toArray()[0]?.cnt as number
      const totalPayout = this.ctx.storage.sql
        .exec(`SELECT SUM(payout) as total FROM bets WHERE market_id = ?`, marketId)
        .toArray()[0]?.total as number | null

      let text = `RESOLVED: "${question}" — ${outcomeLabel} wins!`
      if (winnerCount > 0 && totalPayout) {
        text += ` ${winnerCount} bettor${winnerCount === 1 ? '' : 's'} split ${totalPayout} GitCoins`
      } else {
        text += ` No winners this round`
      }
      this.persistAndBroadcast({
        id: nanoid(),
        sender: 'StatusBot',
        text,
        timestamp: Date.now(),
        isAgent: true,
      })
    }
  }

  private ensureActiveMarkets() {
    if (!this.cachedStatusData) return

    const openCount = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) as cnt FROM markets WHERE status = 'open'`)
      .toArray()[0]?.cnt as number

    if (openCount >= MIN_OPEN_MARKETS) return

    const uptime = this.cachedStatusData.uptimePercent
    const now = Date.now()

    // Check which kinds already have open markets
    const existingKinds = this.ctx.storage.sql
      .exec(`SELECT DISTINCT kind FROM markets WHERE status = 'open'`)
      .toArray()
      .map((r) => r.kind as string)

    for (const template of MARKET_TEMPLATES) {
      if (existingKinds.includes(template.kind)) continue
      if (openCount + (MIN_OPEN_MARKETS - openCount) <= 0) break

      const id = nanoid()
      const question = template.question(uptime)
      const threshold = template.thresholdFn(uptime)
      const resolveAt = now + template.durationMs

      this.ctx.storage.sql.exec(
        `INSERT INTO markets (id, question, kind, threshold, comparison, baseline_value, pool_yes, pool_no, status, resolve_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        id,
        question,
        template.kind,
        threshold,
        template.comparison,
        uptime,
        SEED_POOL,
        SEED_POOL,
        resolveAt,
        now,
      )

      const market = this.readMarket(id)!
      const msg: ServerMessage = { type: 'market-update', market }
      this.broadcast(JSON.stringify(msg))
    }
  }

  private createTestMarkets(connection: Connection<ConnectionState>) {
    // Cancel any existing open markets (refund bets)
    const openMarkets = this.ctx.storage.sql.exec(`SELECT id FROM markets WHERE status = 'open'`).toArray()
    for (const m of openMarkets) {
      const mid = m.id as string
      // Refund all bets on this market
      const bets = this.ctx.storage.sql.exec(`SELECT bettor_id, amount FROM bets WHERE market_id = ?`, mid).toArray()
      for (const b of bets) {
        this.ctx.storage.sql.exec(
          `UPDATE bettors SET balance = balance + ? WHERE id = ?`,
          b.amount as number,
          b.bettor_id as string,
        )
      }
      this.ctx.storage.sql.exec(`DELETE FROM bets WHERE market_id = ?`, mid)
      this.ctx.storage.sql.exec(`DELETE FROM markets WHERE id = ?`, mid)
    }

    const now = Date.now()
    const testMarkets = [
      {
        question: 'Will uptime stay above 99.90% in the next 2 minutes?',
        kind: 'daily-uptime',
        threshold: 99.9,
        comparison: 'above',
        durationMs: 2 * 60 * 1000, // 2 minutes — fast resolution for testing
      },
      {
        question: 'Will there be a major incident in the next 2 minutes?',
        kind: 'incident-today',
        threshold: 3,
        comparison: 'above',
        durationMs: 2 * 60 * 1000,
      },
      {
        question: 'Will uptime drop below 99.95% in the next 5 minutes?',
        kind: 'weekly-uptime',
        threshold: 99.95,
        comparison: 'below',
        durationMs: 5 * 60 * 1000,
      },
    ]

    for (const t of testMarkets) {
      const id = nanoid()
      this.ctx.storage.sql.exec(
        `INSERT INTO markets (id, question, kind, threshold, comparison, baseline_value, pool_yes, pool_no, status, resolve_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        id,
        t.question,
        t.kind,
        t.threshold,
        t.comparison,
        this.cachedStatusData?.uptimePercent ?? 99.95,
        SEED_POOL,
        SEED_POOL,
        now + t.durationMs,
        now,
      )

      const market = this.readMarket(id)!
      const msg: ServerMessage = { type: 'market-update', market }
      this.broadcast(JSON.stringify(msg))
    }

    // Resync the requester so they see updated balance/positions
    this.sendBettingSync(connection)
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
