# GitHub Status Party

Real-time collaborative dashboard tracking GitHub platform uptime with live chat.

**Live:** [ghstatus.party](https://ghstatus.party)

## Stack

- **Framework:** TanStack Start + TanStack Router
- **Real-time:** PartyServer (Durable Objects) + PartySocket
- **Styling:** Tailwind CSS 4 + shadcn/ui (new-york style)
- **Toolchain:** [Vite Plus](https://github.com/voidzero-dev/vite-plus) (`vp`)
- **Deploy:** Cloudflare Workers (`githubparty`)

## Development

```bash
vp install
vp dev
```

## Deploy

```bash
vp run deploy
```
