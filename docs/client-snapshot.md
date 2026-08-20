# Client Snapshot 契約（Client-Safe 字段 → 客戶端落地值）

本文件是 `apps/server/src/snapshot.ts`（server 端字段型別）與
`apps/player-client/scripts/GameState.gd`（`apply_snapshot` 落地值）
之間的**過橋契約**。目的是讓客戶端開發時知道：**server 會送 `null` 的
欄位，`GameState` 收到的 sentinel 是什麼**，避免 `Nil→typed` 崩潰。

> 對齊依據：`apps/player-client/qa_render_check.gd` 情境 `NULL-SNAP`
> （快照全 nullable 皆為 null，`apply_snapshot` 不得崩潰）。

## 規則：nullable 欄位一律以「非 null sentinel」落地

| Server 傳 field | Server 型別 | `null` 時 GameState 落地 | 說明 |
|---|---|---|---|
| `dealer` | `number \| null` | `-1` | 尚未開始 |
| `dealerStreak` | `number` | `0` | 實際非 nullable，仍保守 |
| `turn` | `number \| null` | `-1` | 流局/結算 |
| `gamePhase` | `GamePhase \| null` | `""` | 結算時為 null |
| `lastDiscard` | `string \| null` | `""` | 無牌 |
| `lastDiscardBy` | `number \| null` | `-1` | 無牌 |
| `lastDrawnBy` | `number \| null` | `-1` | 未摸牌 |
| `lastDrawnTile` | `TileWire \| null` | `{}` | 空 dict（`.is_empty()` 檢查） |
| `wall` | object | `{}` | `.get("headRemaining",0)` |
| `reactionHint` | `ReactionHint \| null` | `{}` | `.is_empty()` 判斷反應窗 |
| `canWin` | `boolean` | `false` | `== true` |
| `winner` | `number \| null` | `-1` | 流局 |
| `settlement` | `SettlementView \| null` | `{}` | `.is_empty()` 判斷無結算 |
| `phaseDeadline` | `number \| null` | `-1` | `has_countdown()` = `phase_deadline > 0` |
| `countdownMs` | `number \| null` | `-1` | 同上 |
| `autoplayLog` | `Array \| null` | `[]` | `.is_empty()` 判斷「無」 |

## 特殊：`settlement` 的內部 nullable（`_render_settlement` 已防）

- `settlement.winner`: `number \| null` → 客戶端用 `winner_v == null` 判斷
  **流局**，而非 `settlement.is_empty()`（server 流局時 settlement 非空，
  含全 0 ledger，但 winner/breakdown 是 null）。
- `settlement.breakdown`: `FanBreakdown \| null` → 客戶端用
  `breakdown_v is Dictionary else {}`，null 時略過台數明細。

## Client-Safe 鐵律（防守）

1. 客戶端一律**只渲染** server 給的欄位；缺欄位 → 用 sentinel 顯示「-」，
   不要自行猜張數/胡牌/巡次。
2. `winner==null` = 流局；`settlement` 內 winner null 不代表沒有結算面板。
3. 新步驟：若某個新讀取點「假設欄位必非 null」而 `var x: int = dict.get(...)`，
   就是 regression，會與 `NULL-SNAP` 對抗。