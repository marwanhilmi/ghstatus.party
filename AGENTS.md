# GitHub Status Party

Real-time collaborative dashboard tracking GitHub platform uptime with live chat. TanStack Start (React) on Cloudflare Workers with Durable Objects.

## Commands

```sh
vp install          # Installs deps
vp dev              # Start dev server
vp build            # Production build
vp check            # Format + lint + typecheck
vp run deploy       # Build + wrangler deploy
```

## Stack

- **Framework:** TanStack Start + TanStack Router
- **Real-time:** PartyServer (Durable Objects) + PartySocket
- **Styling:** Tailwind CSS 4 + shadcn/ui (new-york style)
- **Toolchain:** [Vite Plus](https://github.com/voidzero-dev/vite-plus) (`vp`)
- **Package Manager:** pnpm 10 via `vp install`
- **Deploy:** Cloudflare Workers (`githubparty`)

## Path Aliases

`#/*` and `@/*` map to `./src/*`. Prefer `#/` by convention.

## Key Patterns

- **Routes** are file-based in `src/routes/`. `routeTree.gen.ts` is auto-generated — never edit it
- **Real-time** uses PartyServer Durable Objects (`src/party/status-room.ts`) with WebSocket protocol in `src/party/protocol.ts`
- **No traditional database** — all state lives in the Durable Object (cached status + recent chat)
- **Status data** is fetched from external GitHub incident APIs and computed into 90-day uptime metrics
- **Lint/format config** lives in `vite.config.ts` — do not create separate config files
