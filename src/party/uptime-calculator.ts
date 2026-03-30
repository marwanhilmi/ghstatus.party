import type { StatusData } from './protocol'

const INCIDENTS_URL = 'https://mrshu.github.io/github-statuses/parsed/incidents.jsonl'
const WINDOWS_URL = 'https://mrshu.github.io/github-statuses/parsed/downtime_windows.csv'

const impactRank: Record<string, number> = {
  none: 0,
  maintenance: 1,
  minor: 2,
  major: 3,
}

type Incident = {
  id?: string
  title?: string
  impact?: string
  url?: string
  published_at?: string
  updated_at?: string
  downtime_start?: string
  downtime_end?: string
  duration_minutes?: number
  components?: string[]
  status_sequence?: string[]
  updates?: { at: string; status: string; message: string }[]
}

type WindowRow = {
  incident_id?: string
  downtime_start?: string
  downtime_end?: string
  duration_minutes?: string
  source?: string
  title?: string
  impact?: string
}

type WindowEntry = {
  id: string
  title: string
  impact: string
  start: Date
  end: Date
  url: string | null
}

function parseJSONL(text: string): Incident[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Incident)
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function parseCSV(text: string): WindowRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return []
  const headers = parseCSVLine(lines.shift()!)
  return lines.map((line) => {
    const cols = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? ''
    })
    return row as unknown as WindowRow
  })
}

function getDayStartUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function clipInterval(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): [Date, Date] | null {
  const startMs = Math.max(start.getTime(), rangeStart.getTime())
  const endMs = Math.min(end.getTime(), rangeEnd.getTime())
  if (endMs <= startMs) return null
  return [new Date(startMs), new Date(endMs)]
}

function mergeIntervals(intervals: [Date, Date][]): [Date, Date][] {
  if (!intervals.length) return []
  const sorted = intervals.slice().sort((a, b) => a[0].getTime() - b[0].getTime())
  const merged: [Date, Date][] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const current = sorted[i]
    if (current[0].getTime() <= last[1].getTime()) {
      last[1] = new Date(Math.max(last[1].getTime(), current[1].getTime()))
    } else {
      merged.push(current)
    }
  }
  return merged
}

function minutesBetween(start: Date, end: Date): number {
  const startMin = Math.floor(start.getTime() / 60000)
  const endMin = Math.ceil(end.getTime() / 60000)
  return Math.max(0, endMin - startMin)
}

function countsAsDowntime(impact: string): boolean {
  return impact !== 'maintenance'
}

function incidentStartDate(incident: Incident): Date {
  return incident.downtime_start ? new Date(incident.downtime_start) : new Date(incident.published_at!)
}

function formatDateISO(date: Date): string {
  return date.toISOString()
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export async function fetchAndComputeStatus(): Promise<StatusData> {
  const [incidentsRes, windowsRes] = await Promise.all([fetch(INCIDENTS_URL), fetch(WINDOWS_URL)])
  const [incidentsText, windowsText] = await Promise.all([incidentsRes.text(), windowsRes.text()])

  // Use Last-Modified header to determine when the data source was actually updated
  const lastModifiedHeader = incidentsRes.headers.get('last-modified')
  const dataUpdatedAt = lastModifiedHeader ? new Date(lastModifiedHeader).toISOString() : null

  return computeStatusData(incidentsText, windowsText, dataUpdatedAt)
}

function computeStatusData(incidentsText: string, windowsText: string, dataUpdatedAt: string | null): StatusData {
  const incidents = parseJSONL(incidentsText)
  const windows = parseCSV(windowsText)

  const incidentById = new Map<string, Incident>()
  incidents.forEach((incident) => {
    if (incident.id) {
      incidentById.set(String(incident.id), incident)
    }
  })

  incidents.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())

  const now = new Date()
  const today = getDayStartUTC(now)
  const rangeStart = new Date(today)
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 89)
  const rangeEnd = new Date(today)
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

  const windowEntries: WindowEntry[] = windows
    .map((row) => {
      if (!row.downtime_start || !row.downtime_end) return null
      const start = new Date(row.downtime_start)
      const end = new Date(row.downtime_end)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
      return {
        id: row.incident_id || row.title || '',
        title: row.title || 'Incident',
        impact: row.impact || 'none',
        start,
        end,
        url: incidentById.get(String(row.incident_id || ''))?.url || null,
      }
    })
    .filter((e): e is WindowEntry => e !== null)

  const daySeverity = Array.from({ length: 90 }, () => 0)
  const clippedIntervals: [Date, Date][] = []

  windowEntries.forEach((entry) => {
    const clipped = clipInterval(entry.start, entry.end, rangeStart, rangeEnd)
    if (!clipped) return

    if (countsAsDowntime(entry.impact)) {
      clippedIntervals.push(clipped)
    }

    let current = getDayStartUTC(clipped[0])
    const lastDay = getDayStartUTC(clipped[1])
    while (current <= lastDay) {
      const index = Math.floor((current.getTime() - rangeStart.getTime()) / 86400000)
      if (index >= 0 && index < 90) {
        daySeverity[index] = Math.max(daySeverity[index], impactRank[entry.impact] ?? 0)
      }
      current = new Date(current.getTime() + 86400000)
    }
  })

  const merged = mergeIntervals(clippedIntervals)
  const downtimeMinutes = merged.reduce((sum, [start, end]) => sum + minutesBetween(start, end), 0)
  const totalMinutes = 90 * 24 * 60
  const uptime = Math.max(0, 1 - downtimeMinutes / totalMinutes)
  const uptimePercent = parseFloat((uptime * 100).toFixed(2))

  const lastUpdated =
    dataUpdatedAt ?? (incidents[0]?.updated_at ? formatDateISO(new Date(incidents[0].updated_at)) : formatDateISO(now))

  const since = rangeStart.getTime()
  const recentIncidents = incidents
    .filter((incident) => incidentStartDate(incident).getTime() >= since)
    .slice(0, 10)
    .map((incident) => ({
      id: String(incident.id || ''),
      title: incident.title || 'Incident',
      impact: incident.impact || 'none',
      url: incident.url || '',
      date: formatDateShort(incidentStartDate(incident)),
    }))

  const incidentCount = incidents.filter((incident) => incidentStartDate(incident).getTime() >= since).length

  return {
    uptimePercent,
    daySeverity,
    incidentCount,
    lastUpdated,
    lastFetched: formatDateISO(now),
    recentIncidents,
  }
}
