# 台灣 16 張麻將 — Godot 4.7 玩家客戶端 (apps/player-client)

Client-Safe UI：**所有規則判斷都在伺服器**（`apps/server`），本客戶端只負責
顯示伺服器揭露的可觀察狀態，並把玩家的操作以指令送回伺服器。嚴禁在客戶端
實作任何吃碰槓胡判斷邏輯。

---

## 1. 環境需求

- **Godot 4.7**（請用 4.7.x 穩定版開啟本專案，`project.godot` 標記 `config/features=PackedStringArray("4.7", "GL Compatibility")`）
- **Node.js >= 20** + **pnpm**（跑 `apps/server` 用）
- 本專案不需要安裝任何 Godot 外掛或套件

## 2. 啟動伺服器

先啟動權威伺服器（預設埠 **3000**）：

```bash
# 在 monorepo 根目錄
pnpm install
pnpm --filter @taiwan-mahjong/server build
pnpm --filter @taiwan-mahjong/server serve
```

看到以下輸出即代表就緒：

```
[@taiwan-mahjong-server] listening on http://0.0.0.0:3000
[@taiwan-mahjong-server] WebSocket endpoint: ws://localhost:3000/ws
```

健康檢查：`curl http://localhost:3000/health`

可用環境變數：

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `3000` | 監聽埠 |
| `VARIANT` | `north` | 北部 144 張（含花）／`south` 南部 136 張 |

## 3. 用 Godot 開啟專案

1. 開啟 Godot 4.7 → **Import**（匯入）
2. 選取本資料夾的 `project.godot`
3. 匯入後按 **F5（Run Project）**

專案會以 **1280x720** 開啟（`project.godot` 已設定），主場景為
[`scenes/Main.tscn`](scenes/Main.tscn)。

### 專案結構

```
apps/player-client/
├── project.godot          # Godot 設定（解析度、主場景、Autoload）
├── icon.svg
├── scenes/
│   ├── Main.tscn          # 連線 / 開房 / 加入選單
│   ├── Table.tscn         # 牌桌（四家佈局 + 反應視窗 + 結算）
│   └── TileButton.tscn    # 可點擊手牌按鈕（重複使用）
└── scripts/
    ├── NetworkManager.gd  # Autoload — WSS 通訊、自動重連、Ping/Pong
    ├── GameState.gd       # Autoload — Client-Safe 快照全域狀態
    ├── AnimationQueue.gd  # Autoload — 依序播放的 UI 動畫佇列管理器
    ├── main.gd            # 主選單邏輯
    ├── table.gd           # 牌桌渲染（純顯示，無規則判斷）+ 動畫 diff
    └── TileButton.gd      # 手牌點擊 → Discard Command
```

### Autoload 單例（在 `project.godot` 設定）

| 名稱 | 腳本 | 職責 |
|---|---|---|
| `NetworkManager` | [`scripts/NetworkManager.gd`](scripts/NetworkManager.gd) | WSS 連線、事件派發、送出指令 |
| `GameState` | [`scripts/GameState.gd`](scripts/GameState.gd) | 快照狀態 + 顯示輔助（tile 標籤等） |
| `AnimationQueue` | [`scripts/AnimationQueue.gd`](scripts/AnimationQueue.gd) | 依序播放 UI 動畫（摸牌 / 棄牌 / 吃碰槓），`is_playing()` 供 UI 鎖定輸入 |

## 4. 多視窗測試流程（4 位玩家）

因為伺服器是唯一真相來源，你可以開啟**多個 Godot 視窗**模擬 4 位玩家：

### 方式 A：Godot 編輯器多開（推薦）

1. 先啟動伺服器（見上）。
2. 在 Godot 開啟專案 → 按 **F5** 跑第一個視窗。
3. 對同一個專案再按 **F5**（或 Project → 開啟另一個執行個體）。
   Godot 允許同一專案多個執行個體同時運行。
4. 重複直到有 **4 個視窗**。

### 方式 B：匯出執行檔（正式多開）

1. **Project → Export**，先新增一個 **Windows / macOS** 預設範本。
2. 匯出到不同資料夾（例如 `build/p1/`、`build/p2/`…）。
3. 每個執行檔都連到 `ws://localhost:3000/ws`。

### 操作步驟（每個視窗都一樣）

1. 在 **主選單** 輸入玩家名稱（A / B / C / D）。
2. 第一個視窗按 **開房** → 畫面顯示房號（例如 `rXyZ12`）。
3. 其餘三個視窗輸入同一個房號，按 **加入**。
4. 4 人都入座後，各自按 **準備 (Ready)**。
5. 伺服器自動發牌 → 4 個視窗同時切到 **牌桌畫面**（Table）。
6. 輪到你出牌時（上方狀態列顯示「輪到你出牌」），**點擊手牌** 送出。
   - 出牌指令會帶上 `generationId`（防重機制）。
   - 若其他玩家可吃/碰/槓，伺服器會在下家快照的 `reactionHint` 中給出選項，
     畫面下方會出現 **吃 / 碰 / 槓 / 過** 按鈕（僅在伺服器許可時可點）。
   - 快照變化會先拆解成 **動畫佇列**（摸牌飛入手牌 → 棄牌飛入中央 → 吃碰槓移動），
     動畫播放期間手牌與反應按鈕**暫時鎖定**，動畫結束後才刷上最新狀態。
7. 任何玩家湊成合法胡牌（17 張），伺服器**自動胡牌**並結算 → 顯示結算面板。
8. 結算面板列出 **勝者 / 自摸或放槍家 / 台數（含連莊加成）/ 四家分數增減**，
   按 **準備下一局** 送出 ready → 4 人都按完後自動開始下一局。

> 斷線測試：關閉其中一個視窗再重新開啟 → 主選單輸入「同房號 + 剛才的玩家名」，
> 伺服器會以 `playerId` 恢復該座位（含遊戲中）。斷線期間該座位會顯示
> **⚠託管中**，由伺服器代打（出牌逾時自動摸切、反應逾時自動過），重連後恢復手動。

### UI 對照（新增欄位）

| UI 元件 | 資料來源（Snapshot） | 說明 |
|---|---|---|
| 頂列 **倒數計時**（橙色 `⏳`，≤5 秒轉紅） | `phaseDeadline` / `countdownMs` | 目前階段剩餘秒數：出牌思考逾時 / 反應視窗逾時 |
| 頂列 **風圈資訊**（`東風 莊家 X（連莊 N）`） | `dealer` / `dealerStreak` | 莊家位置與連莊計數；`dealerStreak > 0` 表示連莊中 |
| 各家面板標籤 `[莊]` / `⚠託管中` / `⚡離線` | `players[].autoplay` / `players[].connected` | 莊家、自動託管、斷線視覺標記 |
| 結算面板（勝者 / 台數 / 四家增減 / 準備下一局） | `settlement`（`winner`/`breakdown`/`ledger`/`scores`） | 含「莊家連莊台 +N」加成顯示 |
| 結算面板「自動託管：…」摘要 | `autoplayLog` | 本局伺服器代打紀錄（如「B摸切、C過」） |

## 5. 網路協定對照（與 `apps/server` 的 wire contract）

完整型別定義在 [`apps/server/src/protocol.ts`](../server/src/protocol.ts) 與
[`apps/server/src/snapshot.ts`](../server/src/snapshot.ts)。

### Client → Server（指令）

| type | 欄位 | 說明 |
|---|---|---|
| `create` | `playerName` | 開房（自動成為 0 號座位） |
| `join` | `roomId`, `playerName`, `playerId?` | 加入；帶 playerId 可重連恢復座位 |
| `ready` | — | 準備（4 人全 ready → 自動發牌） |
| `discard` | `tileInstanceId`, `generationId` | 出牌（手牌 instanceId） |
| `reaction` | `kind`(chi/peng/kong), `handTileIds`, `kongType?`, `pengMeldId?`, `generationId` | 吃/碰/槓 |
| `pass` | `generationId` | 放棄反應 |
| `ping` | `t` | 心跳（伺服器回 `pong`） |

所有指令都帶 `operationId`（冪等金鑰，同一 operationId 不會執行兩次）。

### Server → Client（事件）

| type | 內容 |
|---|---|
| `welcome` | `playerId`, `roomId` |
| `room.created` | `roomId` |
| `player.joined` / `player.ready` / `player.left` | `seat` 等 |
| `game.started` | `dealer`, `dealerStreak` |
| `game.ended` | `winner`, `ledger`, `scores`, `dealer`, `dealerStreak` 等 |
| `snapshot` | **Client-Safe 快照**（見下） |
| `error` | `code`, `message`, `operationId` |
| `pong` | `t`（延遲量測） |

### Snapshot 的 Client-Safe 原則（`ClientSnapshot`）

- **只有你自己的手牌**有 `hand: [{instanceId, id}]`，其他三家為 `hand: null`。
- 各家只揭露 `handCount`（張數）、`melds`（副露）、`flowers`。
- 牌牆只揭露 `headRemaining` / `deckRemaining`（剩餘張數）。
- `reactionHint` 由伺服器計算（`canChi/canPeng/canKong/chiOptions/kongOptions`），
  客戶端**只顯示、不判斷**。

#### 自動託管 / 莊家相關欄位（本專案新增）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `dealer` | `number \| null` | 莊家座位（0-3）；為 null 表示尚未開始 |
| `dealerStreak` | `number` | 連莊計數：0 = 新任莊家；>=1 = 已連莊 N 次 |
| `phaseDeadline` | `number \| null` | 目前階段自動託管截止時間（epoch ms）；null = 無倒數 |
| `countdownMs` | `number \| null` | 快照當下的剩餘毫秒（客戶端可用 `phaseDeadline` 自行本地倒數） |
| `players[].autoplay` | `boolean` | 該玩家是否由伺服器代打（斷線 / 超時） |
| `players[].connected` | `boolean` | 該玩家連線狀態 |
| `autoplayLog` | `Array<{seat, action, reason, at}>` | 本局自動託管紀錄（`action: "discard"`(摸切) / `"pass"`；`reason: "timeout"` / `"disconnect"`） |

> 倒數顯示建議用 `phaseDeadline - now` 本地計算（`GameState.remaining_ms()`），
> 而不是依賴快照的 `countdownMs`（那只是發送當下的快照值）。

## 6. 動畫佇列（Animation Queue）

快照是「狀態」，不是「事件」；為避免畫面瞬間跳變，`table.gd` 會把
**本次快照 vs 上次已渲染狀態**的差異拆解成依序播放的動畫：

| 動畫 | 觸發（diff） | 內容 |
|---|---|---|
| 摸牌飛入 | 手牌張數增加 | 從牌牆（TopBar 右側）滑入自己手牌末端 |
| 棄牌飛出 | 中央 `discards` 張數增加 | 從棄牌者座位飛入中央棄牌池 |
| 吃碰槓移動 | 某家 `melds` 新增 | 牌面組合（`claimed` 張）飛到該座位副露區 |

### 播放流程（`table.gd` `_render_playing`）

1. 收到新快照 → 若 `AnimationQueue.is_playing()`，**不疊加新動畫**，
   只標記 `_pending_final_render` 並鎖定輸入（避免中間快照跳變）。
2. 否則比較上次渲染狀態，收集動畫 job（`_collect_anim_jobs`）：
   - 每筆 job 是一個 Callable，呼叫後啟動 Tween 並回傳它（或 `null` = 同步完成）。
   - `AnimationQueue` 依序等待每個 Tween `finished` 才播放下一個。
3. 佇列清空 → `queue_drained` 觸發 → 若期間有新快照，`_refresh()` 一次刷上
   最新 Snapshot 的最終畫面。

### 輸入鎖定

- 動畫播放期間：手牌按鈕 `disabled`、反應列隱藏，玩家無法送出指令。
- 首次發牌 / 重連直接畫最終狀態（`_hand_rendered_once`），不做動畫。

### API（`AnimationQueue.gd`）

| 方法 / 訊號 | 說明 |
|---|---|
| `enqueue(job: Callable)` | 加入動畫 job（job 需回傳 Tween 或 null） |
| `is_playing() -> bool` | 佇列是否仍在播放（UI 鎖定輸入用） |
| `clear()` | 丟棄尚未播放的 job（進行中動畫不受影響） |
| `queue_drained` | 佇列完全清空時發出（`table.gd` 在此刷入最終狀態） |

## 7. 指令送出重點（已內建於 NetworkManager.gd）

- 出牌：`NetworkManager.discard(instanceId)` — 自動附上 `GameState.generation_id`。
- 準備：`NetworkManager.mark_ready()`（不能用 `ready()`，會與 Node 內建訊號衝突）。
- 反應：`NetworkManager.react("chi"|"peng"|"kong", handTileIds, extra)`。
- 過：`NetworkManager.pass_reaction()`。
- 每次送出都會自動產生唯一的 `operationId`，因此**連點不會重複執行**。

## 8. 疑難排解

| 症狀 | 處理 |
|---|---|
| 主選單顯示「重連中」 | 確認伺服器有啟動（`pnpm --filter @taiwan-mahjong/server serve`） |
| 畫面停在大廳、按 Ready 無反應 | 需 4 位玩家都入座並都按 Ready 才會自動發牌 |
| 點手牌沒反應 | 確認上方狀態列顯示「輪到你出牌」（turn == you 且 phase == discard） |
| 吃/碰/槓按鈕是灰的 | 表示伺服器快照未授權該反應（例如只有吃可選） |
| 連到遠端伺服器 | 在主選單把「伺服器位址」改成 `ws://<host>:3000/ws` |
