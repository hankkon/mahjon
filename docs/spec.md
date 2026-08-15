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

| 台 | 條件 | 值 |
|---|---|---|
| 自摸 | 自摸胡 | +1 |
| 門清 | 無任何副露 | +1 |
| 門清一摸三 | 自摸 + 無副露 | +3 |
| 碰碰胡 | 全刻子（無吃）+ 5 組 | +4 |
| 混一色 | 單一數牌花色 + 字牌 | +4 |
| 清一色 | 單一數牌花色（無字牌） | +8 |
| 暗刻高階取代 | 每個暗刻 +1；碰碰胡成立時由碰碰胡取代（不疊加） | 0–5 |
| 莊家連莊台 | 莊家胡牌且連莊 streak > 1 | +streak−1 |

- 頂標（cap）：預設 **4 台**，可設定為 8 台；rawTotal 超過 cap 即截斷。
- 裸胡（無任何台）：結算仍至少算 **1 台**（`max(total, 1)`）。
- 自摸：其餘三家各付「台數對應分數」全額給贏家。
- 放槍：放槍者付全額，其餘非贏家各付半額（半額無條件捨去）。

#### 2.5.2 規則待確認 — 門清自摸疊加

現行實作（`scoring.ts` FAN_RULES）在「門清自摸」時**同時疊加**
自摸(+1) + 門清(+1) + 門清一摸三(+3) = **5 台**（raw）。

部分台灣北部牌例把「門清一摸三」視為**取代**前兩者的高階台（= 3 台），
或僅疊加自摸(+1) + 門清一摸三(+3)（= 4 台）。

**現況決策**：既有 golden 測試（GC-02/GC-14/GC-23/GC-25）已鎖定 raw=5，
不可擅自改算法讓測試紅一片。若確認要改成「不重複」語意，需同步：
1. 修改 `scoring.ts` 的 `門清一摸三` 規則（成立時不再計自摸/門清）；
2. 更新 `__tests__/scoring.test.ts` 對應 golden 期望；
3. 更新本小節。

在台灣 16 張北部規則確認前，維持現行疊加語意並標註為
**「規則待確認」**。

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
