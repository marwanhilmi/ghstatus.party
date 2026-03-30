import { Agent } from 'agents'
import type { StatusData } from './protocol'

type AskRequest = {
  question: string
  statusData: StatusData | null
}

function buildSystemPrompt(statusData: StatusData | null): string {
  if (!statusData) {
    return `You are StatusBot, a GitHub uptime assistant embedded in a live chat room. You have no status data available right now. Let the user know and suggest they check back shortly.`
  }

  const severityLabels = ['operational', 'maintenance', 'minor incident', 'major incident']
  const last7Days = statusData.daySeverity.slice(-7)
  const last7Summary = last7Days
    .map((s, i) => {
      const daysAgo = 6 - i
      const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`
      return `${label}: ${severityLabels[s]}`
    })
    .join(', ')

  const incidents = statusData.recentIncidents
    .slice(0, 8)
    .map((inc) => `- [${inc.impact.toUpperCase()}] ${inc.title} (${inc.date})`)
    .join('\n')

  return `You are StatusBot, a GitHub uptime assistant embedded in a live chat room monitoring GitHub's platform status.

Current data (as of ${statusData.lastUpdated}):
- 90-day uptime: ${statusData.uptimePercent.toFixed(2)}%
- Total incidents in 90 days: ${statusData.incidentCount}
- Last 7 days: ${last7Summary}

Recent incidents:
${incidents || '(none)'}

Instructions:
- Answer questions about GitHub downtime, incidents, and uptime concisely (2-4 sentences max).
- Reference specific incidents and dates from the data when relevant.
- If asked about something outside GitHub status, politely redirect.
- Be friendly and brief — this is a chat room, not a report.`
}

function extractAnswer(result: unknown): string | undefined {
  if (typeof result === 'string') return result

  const raw = result as Record<string, unknown>

  // Workers AI native: { response: "..." }
  if (typeof raw.response === 'string') return raw.response

  // OpenAI chat completion: { choices: [{ message: { content: "..." } }] }
  if (Array.isArray(raw.choices)) {
    for (const choice of raw.choices as Record<string, unknown>[]) {
      const msg = choice?.message as Record<string, unknown> | undefined
      if (typeof msg?.content === 'string') return msg.content
    }
  }

  // Fallback: dig for any string `content` or `text` field
  if (typeof raw.content === 'string') return raw.content
  if (typeof raw.text === 'string') return raw.text

  return undefined
}

export class DowntimeAgent extends Agent<Env> {
  // Override fetch directly to bypass partyserver routing headers requirement.
  // This agent is called internally by StatusRoom, not via client WebSocket.
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const { question, statusData } = (await request.json()) as AskRequest

    const result = await (this.env.AI as any).run('@cf/openai/gpt-oss-20b', {
      messages: [
        { role: 'system', content: buildSystemPrompt(statusData) },
        { role: 'user', content: question },
      ],
    })

    const answer = extractAnswer(result)
    if (!answer) console.log('Unhandled AI response shape:', JSON.stringify(result))

    return Response.json({ answer: answer || 'No response from AI model.' })
  }
}
