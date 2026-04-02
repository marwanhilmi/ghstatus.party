export type IncidentSummary = {
  id: string
  title: string
  impact: string
  url: string
  date: string
}

export type ComponentStatus = {
  name: string
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage'
}

export type ActiveIncident = {
  id: string
  name: string
  impact: 'none' | 'minor' | 'major' | 'critical'
  status: string // investigating, identified, monitoring, resolved
  shortlink: string
  createdAt: string
  updatedAt: string
}

export type LiveStatus = {
  indicator: 'none' | 'minor' | 'major' | 'critical'
  description: string
  components: ComponentStatus[]
  activeIncidents: ActiveIncident[]
}

export type StatusData = {
  uptimePercent: number
  daySeverity: number[] // 90 elements: 0=operational, 1=maintenance, 2=minor, 3=major
  incidentCount: number
  lastUpdated: string // ISO timestamp — when the upstream data source was last modified
  lastFetched: string // ISO timestamp — when the DO last fetched upstream data
  recentIncidents: IncidentSummary[]
  liveStatus: LiveStatus | null
}

export type ChatMessage = {
  id: string
  sender: string
  text: string
  timestamp: number
  isAgent?: boolean
}

// Server -> Client
export type ServerMessage =
  | {
      type: 'welcome'
      name: string
      data: StatusData | null
      presence: number
      recentMessages: ChatMessage[]
      version: string
    }
  | { type: 'status-update'; data: StatusData }
  | { type: 'chat-message'; message: ChatMessage }
  | { type: 'presence'; count: number }
  | { type: 'confetti-trigger'; uptime: number }
  | { type: 'agent-thinking' }
  | { type: 'message-deleted'; id: string }
  | { type: 'message-edited'; message: ChatMessage }
  | {
      type: 'betting-sync'
      markets: Market[]
      balance: number
      positions: BetPosition[]
      leaderboard: LeaderboardEntry[]
    }
  | { type: 'market-update'; market: Market }
  | { type: 'market-resolved'; market: Market; yourPayout: number | null }
  | { type: 'balance-update'; balance: number }
  | { type: 'bet-confirmed'; position: BetPosition; market: Market; balance: number }
  | { type: 'bet-error'; message: string }

// --- Betting types ---

export type Market = {
  id: string
  question: string
  kind: string
  poolYes: number
  poolNo: number
  status: 'open' | 'resolved_yes' | 'resolved_no'
  resolveAt: number
  createdAt: number
}

export type BetPosition = {
  marketId: string
  side: 'yes' | 'no'
  amount: number
  payout: number | null
}

export type LeaderboardEntry = {
  name: string
  totalWon: number
}

// Client -> Server
export type ClientMessage =
  | { type: 'chat'; text: string }
  | { type: 'place-bet'; marketId: string; side: 'yes' | 'no'; amount: number }
  | { type: 'create-test-markets' }
  | { type: 'resolve-test-markets' }
