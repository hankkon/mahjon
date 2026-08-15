# apps/server

Node.js + TypeScript authoritative WebSocket (WSS) server.

## Responsibilities

- Room lifecycle (create / join / start / end)
- Authoritative state transitions with monotonically increasing **Generation ID**
- **Command Deduplication** — rejects stale or already-applied commands
- Applies domain logic from `@taiwan-mahjong/rules`; never invents rules itself

## Scripts

```sh
pnpm dev      # run with node --watch (after build)
pnpm build    # tsc
pnpm typecheck
```
