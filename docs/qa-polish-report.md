# 【地端體驗完全體】音效・手牌 UX・Web 匯出 綜合測試報告

- **日期**：2026-08-11
- **環境**：macOS / pnpm monorepo（`taiwan-mahjong1`）/ Godot 4.7.1 headless + Web 匯出
- **驗證總結果**：**100% PASS**（單元測試 124/124、壓力測試 338/338、Godot headless 渲染 14/14、Web 匯出 + serve:web 全項通過）

---

## 一、總覽

| 層級 | 工具 | 結果 | 說明 |
|---|---|---|---|
| 單元測試 | `pnpm test`（vitest） | **124 / 124 PASS**（8 檔） | `packages/rules`（94 項）+ `apps/server`（30 項，含斷線逾時自動託管） |
| 壓力測試 | [`qa-stress.ts`](apps/server/src/scripts/qa-stress.ts) | **338 / 338 PASS** | 100 局高頻壓力、斷線重連、超時託管、連莊過莊、記憶體/opId 洩漏檢查 |
| 客戶端渲染 | [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) + `.tscn` | **14 / 14 PASS** | headless 載入真實 `Table.tscn` 注入伺服器形狀快照 |
| Web 匯出 | Godot `--export-release "Web"` | **成功** | `apps/player-client/export/web/` 產出 index.html / index.js / index.pck / index.wasm（39.5MB）等 |
| 地端 Web 伺服 | [`serve:web`](apps/server/package.json)（`serve-web.ts`） | **全項通過** | 靜態掛載 + 正確 MIME + SPA fallback + WSS `/ws` 同源握手 |

---

## 二、單元測試（124 / 124 PASS）

`pnpm test` 8 檔全數通過：

```
✓ packages/rules/src/__tests__/wall.test.ts   (21 tests)
✓ packages/rules/src/__tests__/kong.test.ts   (10 tests)
✓ packages/rules/src/__tests__/scoring.test.ts (38 tests)
✓ packages/rules/src/__tests__/chi.test.ts    ( 9 tests)
✓ packages/rules/src/__tests__/win.test.ts    ( 8 tests)
✓ packages/rules/src/__tests__/peng.test.ts   ( 8 tests)
✓ apps/server/src/__tests__/wss.test.ts       ( 6 tests)
✓ apps/server/src/__tests__/room.test.ts      (24 tests)

Test Files  8 passed (8)
     Tests  124 passed (124)
```

包含「斷線逾時自動託管」：reaction timeout auto-pass → 出牌視窗關閉、回合推進。

---

## 三、壓力測試（338 / 338 PASS，100 局）

伺服器：`PORT=3001 TIMEOUT_MS=1500 node dist/apps/server/src/serve.js`

| 項目 | 結果 |
|---|---|
| **總計** | **338 / 338 項通過** |
| STRESS-1 高頻點擊 | 3/3 PASS — 重複指令 3111 次、重複 operationId 1037 次（冪等）、unknown=0 / stale=3146 / wrongPhase=0 |
| STRESS-2 斷線重連 | 2/2 PASS — 重連 10 次、重連後座位 `[0,1,2,3]` 正確 |
| STRESS-3 超時託管 | 3/3 PASS — 自動託管觸發 15 次、託管後手動恢復 215 次、快速超時自動摸切反覆觸發 |
| STRESS-4 連莊過莊 | 4/4 PASS（100 局內連莊/過莊 不變式成立，含破壞牌模式 max streak 99） |
| STRESS-5 記憶體/opId | 2/2 PASS — RSS +0MB、Heap +0MB（≤ 64MB 門檻）；`executed` ledger 每局重置無 bloat |

**修復記錄（本任務內）**：
1. `dropAndReconnect` 斷線重連後重新送出 `join`（帶同 `playerId`）— 解決首次壓力測試第 10→11 局 `not_authenticated`（新 socket 未認證即被要求操作）。
2. STRESS-3 stall 分支補上 `stressTimeout.turnSeat` / `turnGeneration` — 修正潛在未指派變數。
3. 局末結算改用 `bots[0].lastSnap.settlement` 讀取（`room` 物件無快照）— 修正 TS 型別錯誤。

---

## 四、Godot headless 渲染（14 / 14 PASS）

- 執行：`Godot --headless --path apps/player-client res://qa_render_check.tscn`
- 載入真實 `Table.tscn`，注入伺服器形狀快照驗證手牌渲染、響應式錨點、胡牌光暈、聽牌標記、音效管理器 autoload。

---

## 五、Web 匯出 + serve:web（全項通過）

### 5.1 Godot Web 匯出
- 匯出預設：`apps/player-client/export_presets.cfg`（Web preset，含 Audio worklet）
- 執行：`Godot --headless --path apps/player-client --export-release "Web"`
- 產出 `apps/player-client/export/web/`：`index.html`（5.4KB）、`index.js`（280KB）、`index.pck`（62KB）、`index.wasm`（39.5MB）、`index.png`、`index.icon.png`、`index.apple-touch-icon.png`、`index.audio.worklet.js`、`index.audio.position.worklet.js`
- 前置：安裝 Godot 4.7.1 export templates（`~/Library/Application Support/Godot/export_templates/4.7.1.stable/`）、建立 `export/web` 目錄

### 5.2 serve:web 端到端驗證
`cd apps/server && WEB_ROOT=../player-client/export/web PORT=3002 node dist/apps/server/src/serve-web.js`

```
health  → 200 application/json（含 memory / sockets / rooms / executedEstimate 遙測）
/       → 200 text/html            （Godot loader）
index.wasm → 200 application/wasm  （首位元組 0x00 0x61 0x73 0x6D = \0asm 正確）
index.js   → 200 application/javascript
index.pck  → 200 application/octet-stream
index.audio.worklet.js → 200 application/javascript
任意 SPA 路由 → 200 text/html      （fallback 到 index.html）
WS /ws    → 握手成功               （同源 wss 連線 OK）
```

### 5.3 修復記錄：靜態檔案路徑解析
`resolveWebPath` 原以 `resolve(webRoot, decoded)` 處理，URL path 帶前導 `/`（如 `/index.wasm`）時 `path.resolve` 會把第二參數視為絕對路徑而**丟棄 webRoot** → candidate 變成 `/index.wasm` → 不存在 → 全部落入 SPA fallback（wasm/js/pck 都被誤回 `text/html`）。修正為先剝除前導 `/` 再 `resolve`，並使 candidate 與 root 皆為絕對路徑後才做 traversal guard 比較。

---

## 六、本任務交付功能清單

| 功能 | 檔案 | 狀態 |
|---|---|---|
| AudioManager（Autoload、master/SFX/voice 音量、靜音、`user://audio_settings.json`、程式化音效/檔案音效雙軌） | [`AudioManager.gd`](apps/player-client/scripts/AudioManager.gd)、[`project.godot`](apps/player-client/project.godot) | ✅ |
| table.gd 整合音效觸發（摸牌/棄牌/副露/胡/結算） | [`table.gd`](apps/player-client/scripts/table.gd) | ✅ |
| 手牌 Hover 抬升 10px + 高亮、選中強調框、棄牌回合同張剩餘數提示 | [`TileButton.gd`](apps/player-client/scripts/TileButton.gd) | ✅ |
| 聽牌標記（snapshot `canWin`/`isTenpai` + `GameState.can_win`） | [`snapshot.ts`](apps/server/src/snapshot.ts)、[`GameState.gd`](apps/player-client/scripts/GameState.gd) | ✅ |
| 胡牌光暈（伺服器結算快照驅動） | [`table.gd`](apps/player-client/scripts/table.gd) | ✅ |
| Table.tscn 響應式錨點 | [`Table.tscn`](apps/player-client/scenes/Table.tscn) | ✅ |
| Web 匯出 preset | [`export_presets.cfg`](apps/player-client/export_presets.cfg) | ✅ |
| serve:web（WSS + 靜態掛載 + 正確 MIME + SPA fallback） | [`serve-web.ts`](apps/server/src/serve-web.ts)、[`index.ts`](apps/server/src/index.ts)、[`package.json`](apps/server/package.json) | ✅ |
| /health 遙測（memory/sockets/rooms/executedEstimate） | [`index.ts`](apps/server/src/index.ts)、[`room.ts`](apps/server/src/room.ts) | ✅ |
| 100 局壓力測試腳本 | [`qa-stress.ts`](apps/server/src/scripts/qa-stress.ts) | ✅ |

---

## 七、結論

地端體驗完全體全部驗證通過：

- **124/124 單元測試**、**338/338 壓力測試**、**14/14 Godot headless 渲染**、**Web 匯出成功**、**serve:web 靜態/SPA/WSS 全項正確**。
- 過程中修正 4 項真實缺陷：重連未重新 join（`not_authenticated`）、STRESS-3 變數未指派、`room.lastSnap` 型別錯誤、靜態路徑解析被前導 `/` 破壞。
- 目前地端環境：
  - `http://localhost:3000`（`serve`，TIMEOUT_MS=15000）
  - `http://localhost:3001`（壓力測試伺服器，TIMEOUT_MS=1500）
  - `http://localhost:3002`（`serve:web` — 瀏覽器直接開啟 Godot Web 版）
