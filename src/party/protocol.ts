export type IncidentSummary = {
  id: string
  title: string
  impact: string
  url: string
  date: string
}

export type StatusData = {
  uptimePercent: number
  daySeverity: number[] // 90 elements: 0=operational, 1=maintenance, 2=minor, 3=major
  incidentCount: number
  lastUpdated: string // ISO timestamp — when the upstream data source was last modified
  lastFetched: string // ISO timestamp — when the DO last fetched upstream data
  recentIncidents: IncidentSummary[]
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

// Client -> Server
export type ClientMessage = { type: 'chat'; text: string }
