# GitHub Status Party

Real-time collaborative dashboard tracking GitHub platform uptime with live chat. TanStack Start (React) on Cloudflare Workers with Durable Objects.

## Toolchain — Vite Plus (`vp`)

Unified CLI wrapping Vite, Vitest, Oxlint, Oxfmt, and Rolldown. All config lives in `vite.config.ts`.

### Core Commands

```sh
vp dev              # Start dev server (Vite)
vp build            # Production build (Rolldown)
vp preview          # Preview production build locally
vp test run         # Run tests once (Vitest, no watch)
vp test             # Run tests in watch mode
```

### Code Quality

```sh
vp check            # Format + lint + typecheck (all-in-one)
vp lint             # Lint only (Oxlint, type-aware)
vp fmt              # Format only (Oxfmt)
vp lint --fix       # Auto-fix lint issues
vp fmt --write      # Write formatted files
```

### Package Management

```sh
vp install          # Install dependencies (detects pnpm)
vp add <pkg>        # Add dependency
vp add -D <pkg>     # Add dev dependency
vp remove <pkg>     # Remove dependency
```

### Task Runner

```sh
vp run <script>     # Run package.json script (cached)
vpx <bin>           # Run local binary, download if missing
vp exec <bin>       # Run from node_modules/.bin
```

### Other

```sh
vp upgrade          # Upgrade global vp binary
vp update vite-plus # Update local vite-plus package
vp env              # Manage Node.js versions
vp cache clean      # Clear task cache
```

> `vp build` uses Rolldown (built-in). `vp run build` runs the `build` script from package.json. They are different.

## Package Manager

- **pnpm 10** — lockfile: `pnpm-lock.yaml`
- Use `vp run` instead of `pnpm run` for scripts
- Do not use npm or yarn

## Scripts

```sh
vp run deploy         # Build + wrangler deploy
```

## Stack

| Layer      | Tool                                        |
| ---------- | ------------------------------------------- |
| Framework  | TanStack Start + TanStack Router            |
| Queries    | TanStack React Query                        |
| Real-time  | PartyServer (Durable Objects) + PartySocket |
| Styling    | Tailwind CSS 4                              |
| Components | shadcn/ui (new-york style)                  |
| Deploy     | Cloudflare Workers via Wrangler             |

## Path Aliases

```
#/* → ./src/*
@/* → ./src/*
```

Defined in `tsconfig.json`. Prefer `#/` by convention.

## Project Structure

```
src/
  components/
    party/          # PartyRoom, UptimeDashboard, UptimeBars, ChatPanel, PresenceBadge, ConfettiOverlay
    ui/             # shadcn/ui primitives
  party/            # Server-side Durable Object logic
    status-room.ts  # StatusRoom DO — WebSocket hub, status polling, chat relay
    uptime-calculator.ts  # Fetches + parses GitHub incident data into uptime metrics
    protocol.ts     # Shared types for server↔client WebSocket messages
    names.ts        # Random name generator for anonymous chat users
  integrations/     # TanStack Query provider
  lib/              # Shared utilities (cn helper)
  routes/           # TanStack Router file-based routes
  styles.css        # Tailwind + purple/pink/gold "Party" theme CSS
public/             # Static assets
```

## Key Patterns

- **Routes** are file-based in `src/routes/`. `routeTree.gen.ts` is auto-generated — never edit it
- **Real-time** uses PartyServer Durable Objects (`src/party/status-room.ts`) with WebSocket protocol defined in `src/party/protocol.ts`
- **No traditional database** — all state lives in the Durable Object (cached status data + recent chat messages)
- **Status data** is fetched from external GitHub incident APIs and computed into 90-day uptime metrics
- **Confetti mode** triggers when uptime drops below 89.99% — plays Prince "1999" video
- **Lint/format config** lives in `vite.config.ts` (`lint` and `fmt` blocks) — do not create separate config files

## Cloudflare Bindings

- Durable Object: `StatusRoom` (class_name: `StatusRoom`, SQLite-backed) — see `wrangler.jsonc`
- No D1 or KV bindings

## Deployment

```sh
vp run deploy       # pnpm run build && wrangler deploy
```

Target: Cloudflare Workers. Worker name: `githubparty`.
