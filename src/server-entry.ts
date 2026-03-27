import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { routePartykitRequest } from 'partyserver'
import { env } from 'cloudflare:workers'

// Re-export the Durable Object class so wrangler can bind it
export { StatusRoom } from './party/status-room'

const startHandler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request): Promise<Response> {
    // PartyKit routes: /parties/status-room/:roomName
    const partyResponse = await routePartykitRequest(request, env)
    if (partyResponse) return partyResponse

    // Everything else: TanStack Start
    return startHandler(request)
  },
}
