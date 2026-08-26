# Taiwan 16-Tile Mahjong — System Specification

> 台灣 16 張麻將 · Godot 4.7 Client + Node.js/TypeScript Authoritative Server
> Single-repository (pnpm Monorepo)

---

## 1. Core Principles

### 1.1 Authoritative Server (伺服器權威)

The **server is the single source of truth** for all game state and rule
judgment. The Godot client is a **Client-Safe UI** only:

- The client renders state received from the server.
- The client **never** decides legal moves, tile validity, win/hu determination,
  scoring, or turn order.
- Every state-changing action from a client is a **command proposal**; the
  server validates it against the authoritative rules before applying it.
- Any client can be replaced (reconnect) at any time and the authoritative
  state fully reconstructs its UI.

**Rule judgment lives exclusively in `packages/rules`** (the Domain layer).
`apps/server` merely applies Domain logic to network events.

### 1.2 Generation ID & Command Deduplication

- Every authoritative state transition carries a monotonically increasing
  **Generation ID**.
- Clients echo the Generation ID they last observed when sending commands.
- The server rejects (deduplicates) commands whose Generation ID has already
  been applied or is stale, preventing double-move / replay attacks.

---

## 2. Rule Baseline — Taiwan 16-Tile Mahjong (台灣 16 張麻將)

### 2.1 Tile Set

| Variant | Tiles |
|---|---|
| 北部 (North) — default | **144 tiles** (萬/筒/條/風/三元 + 花牌) |
| 南部 (South) | **136 tiles** (無花牌) |

Suits:
- 萬 (Characters): 1–9, ×4 each
- 筒 (Dots): 1–9, ×4 each
- 條 (Bamboo): 1–9, ×4 each
- 風 (Winds): 東/南/西/北, ×4 each
- 三元 (Dragons): 中/發/白, ×4 each
- 花 (Flowers & Seasons, 北部 only): 梅/蘭/竹/菊 + 春/夏/秋/冬, ×1 each (8 tiles → 144 total)

### 2.2 Deal

- **莊家 (Dealer): 17 tiles**
- **閒家 (Non-dealers): 16 tiles each**

### 2.2.1 Dice Wall Opening (骰子定門) — TAIWAN_WALL_OPENING_V1

Before dealing, the dealer rolls **three dice** (each 1–6, total 3–18). The
shuffled wall is arranged as 2-tile stacks (北部 72 stacks / 南部 68 stacks,
18 / 17 per side):

- **Opening seat (開門位)**: `openingSeat = dealer + (total − 1) mod 4`.
- **Break point (斷牌點)**: count `total` stacks from the opening seat's right
  edge; normal draws traverse the remaining stacks in ascending circular order.
- The last 16 tiles of the resolved order stay the reserved tail (尾 16 張),
  preserving the double-cursor model.

Implemented in `packages/rules/src/dice.ts` (roll/validation) and
`wall.ts` `applyWallOpening`. The room rolls dice per hand in `startGame`.

### 2.3 Fixed Tail — Double-Cursor Model (雙游標)

The wall keeps a **fixed reserved tail of 16 tiles** (the 尾 16 張), never drawn
by normal play. The two cursors are:

- **Wall cursor (牆前游標)**: tiles available to draw from the head.
- **Deck cursor (牌池游標)**: tiles available to draw after the wall is
  exhausted (補花/槓 reserve for flowers and kong replacements).

The tail is never drawn by players in ordinary turns; it is only consumed by
flower replacement (補花) or kong replacement (槓上補牌).

### 2.4 Win (胡)

- **Legal = auto-win (合法即自動胡牌)**: there is **no 胡/過 button**.
  When a hand is legal to win, the server automatically declares the win.
- This keeps the zero-sum ledger consistent and removes client choice from rule
  judgment.

### 2.5 Scoring — Four-Player Zero-Sum Ledger (四人零和 Ledger)

- Each round, total score delta across all four players = **0**.
- The ledger is stored as a four-entry signed account for each player
  (balance ∈ ℤ), maintained by the server.

#### 2.5.1 Fan Matrix (台數矩陣) — 現行實作

> 整合自參考實作的 Taiwan V1 scoring policy（GameTower 台灣 16 張牌例、
> 台灣麻將協會歸檔規則）。互斥取高：後者必然涵蓋前者時，只計高者。

| 台 | 條件 | 值 |
|---|---|---|
| 天胡 | 莊家起手 17 張即胡 | +24 |
| 地胡 | 閒家第一輪自摸（無人副露） | +16 |
| 自摸 | 自摸胡（有副露時） | +1 |
| 門清 | 放槍、無任何副露 | +1 |
| 門清一摸三 | 自摸 + 無副露（**取代** 自摸+門清，互斥取高） | +3 |
| 平胡 | 全順子、放槍、無花、且非邊/坎/單吊聽 | +2 |
| 碰碰胡 | 全刻子（無吃）+ 5 組 | +4 |
| 混一色 | 單一數牌花色 + 字牌 | +4 |
| 清一色 | 單一數牌花色（無字牌） | +8 |
| 字一色 | 全字牌 | +16 |
| 大三元 | 中發白皆為刻子 | +8 |
| 小三元 | 中發白兩刻一對 | +4 |
| 大四喜 | 東南西北皆為刻子 | +16 |
| 小四喜 | 東南西北三刻一對 | +8 |
| 全求人 | 四副露 + 單吊將（放槍胡） | +2 |
| 三暗刻 / 四暗刻 / 五暗刻 | 3 / 4 / 5 個暗刻（含暗槓） | +2 / +5 / +8 |
| 邊張 / 坎張 / 單吊 | 單聽（唯一胡張）且胡牌張角色唯一；**僅北部** | +1 各 |
| 槓上開花 | 槓上補牌自摸 | +1 |
| 搶槓 | 搶加槓胡牌 | +1 |
| 海底撈月 | 摸到牆內最後一張牌自摸 | +1 |
| 河底撈魚 | 最後一張牌放槍胡 | +1 |
| 花牌 | 正花 +1 / 花槓（春夏秋冬、梅蘭竹菊）+2 / 八仙過海 +8 / 七搶一 +8 | 0–8 |
| 莊家連莊台 | 莊家胡牌且連莊 streak > 1 | +streak−1 |

**互斥取高（Implication exclusions）**：
- 門清一摸三 取代 自摸 + 門清（門清自摸 = 3 台）。
- 五暗刻 取代 四暗刻、三暗刻、碰碰胡、門清。
- 四暗刻 取代 三暗刻。
- 全求人 取代 單吊。
- 邊張 / 坎張 / 單吊 排除 平胡（南部變體不計邊/坎/單吊，故不排除平胡）。

- 頂標（cap）：預設 **4 台**，可設定為 8 台；rawTotal 超過 cap 即截斷。
- 裸胡（無任何台）：結算仍至少算 **1 台**（`max(total, 1)`）。
- 自摸：其餘三家各付「台數對應分數」全額給贏家。
- 放槍：放槍者付全額，其餘非贏家各付半額（半額無條件捨去）。

#### 2.5.2 門清自摸語意 — 已定案

門清自摸（門清一摸三）已依參考實作定案為 **3 台**：`門清一摸三` 是取代
`自摸(+1)` 與 `門清(+1)` 的高階台（互斥取高），不再疊加為 5 台。
既有 golden 測試（GC-02/GC-09/GC-14/GC-23/GC-25 等）已同步更新鎖定 raw=3 語意。

---

## 3. Repository Layout

```
taiwan-mahjong1/
├── docs/
│   └── spec.md                  # This document
├── packages/
│   └── rules/                   # Authoritative Domain (backend authority)
│       └── src/
│           ├── tiles.ts         # Tile Identity types
│           ├── rng.ts           # Secure shuffle RNG
│           ├── wall.ts          # Wall, deal, double-cursor, flower chain
│           └── __tests__/
│               └── wall.test.ts
├── apps/
│   ├── server/                  # Node.js + TS WebSocket (WSS) server
│   │   ├── package.json
│   │   └── src/                 # Room lifecycle, Generation ID, dedup
│   └── player-client/           # Godot 4.7 client project (reserved)
│       └── README.md
├── package.json                 # Root (pnpm workspace root)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

---

## 4. Flower Replacement — IMMEDIATE_TAIL_CHAIN_V1 (北部連續補花)

When the dealer draws a flower (or any player's replacement draws a flower),
the replacement is taken **immediately from the deck cursor** in a chain until
a non-flower tile is drawn — versioned `IMMEDIATE_TAIL_CHAIN_V1`.

Because flowers never occupy the hand, each flower drawn adds one extra tile
from the reserved deck cursor into the player's hand, preserving hand count
while the wall/head is not disturbed for regular turns.

---

## 5. Persistence & Seat Credentials (持久化與座位憑證)

### 5.1 Room Persistence (SQLite)

When `SQLITE_PATH` is set, every room mutation (join/ready/command/disconnect/
autoplay) is persisted to SQLite (`node:sqlite`, WAL journaling):

- **Schema**: `rooms` (id, variant, status, snapshot_json, generation_id,
  updated_at) + `schema_version`.
- **Snapshot** (`Room.serialize()`): players, authoritative `GameState`, dealer
  rotation, scores, generationId, the operationId→fingerprint dedup map, the
  autoplay log, and the **exact xorshift RNG state** (`SeededRng.getState()`),
  so a restored room resumes the exact next-hand shuffle sequence.
- **Restore** (`RoomManager.loadPersisted()`): rooms are rebuilt offline
  (timers paused); the first socket reconnect with the player's identity
  resumes control via the normal `setConnected(true)` path.
- **Single-instance architecture**: SQLite persistence (`SqliteRoomRepository`)
  is designed for single-instance durability, crash recovery, and restart
  persistence. The in-memory `RoomManager` is the single authoritative source of
  truth. Active-active multi-process concurrent writes on a shared SQLite database
  are explicitly unsupported. In scaled / multi-instance deployments, sticky room
  routing (sharding per room) or a distributed coordinator must be used.

### 5.2 Command Dedup — durable & content-locked

Every command carries an `operationId`. The server stores `operationId →
canonical payload fingerprint`:
- Replaying the same id + same payload → idempotent `ok` (no re-execution).
- Reusing the same id with a **different payload** → rejected
  (`command_id_reused`) — a client cannot burn an id and smuggle a different
  action through it.
- The map is persisted in the room snapshot, so crash-replay stays safe.

### 5.3 Seat Credentials

When `SEAT_CREDENTIAL_SECRET` is set, each join issues an HMAC time-bound
bearer credential `v1.<generation>.<expiresAt>.<sig>` bound to
`roomId \0 seat \0 playerId`:

- Reconnecting to an already-seated `playerId` **requires** a valid unexpired
  credential — a player cannot guess into another player's seat.
- `rotateRoomCredentials(roomId)` bumps the generation and invalidates every
  previously issued credential for that room.
- The Godot client stores the credential from `welcome`/`player.joined` and
  sends it automatically on reconnect.

### 5.4 Server lifecycle

- `serve.ts` / `serve-web.ts` print a machine-readable `GAME_SERVER_READY`
  JSON line after binding (for Docker/PM2 supervisors).
- Server-side socket heartbeat pings and terminates unresponsive sockets
  (`HEARTBEAT_INTERVAL_MS`, default 30s).
- Background cleanup scheduler periodically purges abandoned/empty rooms
  (`CLEANUP_INTERVAL_MS`, default 5min).

### 5.5 Provably Fair Verification (Stake-Compliant 可證明公平性機制)

To ensure tamper-proof fairness and mathematical verifiability for every round:
1. **Server Seed (伺服器種子)**: Generated as a 256-bit CSPRNG hex string by the server.
2. **Server Seed Hash Commitment (承諾哈希)**: Before any hand begins, the server calculates and broadcasts `serverSeedHash = SHA256(serverSeed)` in the pre-game snapshot. The server cannot modify the secret seed after players join or see their tiles.
3. **Client Seed (客戶端種子)**: Provided by the players/room (customizable via `set_client_seed` command or CSPRNG generated).
4. **Nonce (局號序號)**: Monotonically increments per hand (`1`, `2`, `3`...).
5. **Deterministic Derivation**: The PRNG seed driving the deal and dice roll is derived via HMAC-SHA256:
   ```ts
   derivedSeed = HMAC_SHA256(key = serverSeed, data = `${clientSeed}:${nonce}`)
   ```
6. **Post-Game Reveal & Audit (開牌驗證)**:
   Upon hand conclusion (`game.ended` / settlement), the server reveals plaintext `serverSeed`. Any client or third-party auditor can verify:
   - `SHA256(serverSeed) === serverSeedHash` (guarantees no mid-game seed tampering).
   - Replaying `createProvablyFairRng(serverSeed, clientSeed, nonce)` reproduces the exact same tile wall, dice roll, and draw order.

