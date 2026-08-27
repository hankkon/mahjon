# Overnight Report

## Baseline（測試 before）
- **Test Files**: 14 passed (14)
- **Tests**: 243 passed, 0 failed (1.39s)
- **Godot QA Render Check**: 58 passed, 0 failed

---

## Done（對應 P0-A… 打勾，寫測試檔名）

- [x] **P0-A**: `Room.startGame()` 累積分數修正 — 移除 `startGame()` 內的 `this.scores = [0, 0, 0, 0]`，確保多局連打時分數持續累計。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`apps/server/src/__tests__/room.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/room.test.ts)
- [x] **P0-B**: `finishWin()` 莊家輪替與 `WinContext` 時序修正 — 結算與算台（`tianHu`/`diHu`/正花）使用「本局莊家」，避免閒家胡牌換莊後 `diHu` 誤判為 false。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts)
- [x] **P0-C**: 一砲多響 (Multi-Win) 零和結算 — 所有可胡者皆自動宣告胡牌；放槍者付全額給每位胡家，其餘非胡者付半額給每位胡家，胡家互不付費，`sum(delta) === 0`。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`packages/rules/src/__tests__/scoring.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/scoring.test.ts)
- [x] **P0-D**: 搶槓 (qiangKong) 顯式傳遞加槓牌與獨立副露判斷 — 搶槓牌直接由 add-on 牌取得（不從 `lastDiscard` 讀取），搶槓者以自身手牌與副露判定，放槍者為槓牌者。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`packages/rules/src/__tests__/kong.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/kong.test.ts)
- [x] **P0-E**: 槓上開花 (kongDraw) 補牌自動胡 — 尾牆補牌 (`drawFromDeck`) 後立即檢測胡牌，並以 `kongDraw = true` 自動結算 (+1 台)。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts)
- [x] **P0-F**: 天胡 (+24 台) 與地胡 (+16 台) 完整覆蓋與測試。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`packages/rules/src/__tests__/scoring.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/scoring.test.ts)
- [x] **P0-G**: 流局 (Exhaustive Draw) 結算 — 四家 delta 均為 0，分數不變，莊家連莊 `dealerStreak += 1`。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`apps/server/src/__tests__/room.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/room.test.ts)
- [x] **P0-H**: 雙游標牌牆張數恆等性 — 北部 144 張 / 南部 136 張，花牌不進手牌，尾 16 張保留給摸補花與槓牌補牌。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`packages/rules/src/__tests__/wall.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/wall.test.ts)
- [x] **P0-I**: operationId 冪等性與衝突驗證 — 同 id 同 payload 回傳冪等 `ok`；同 id 不同 payload 拒絕 `command_id_reused`；重試先於 stale generation 檢查。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`apps/server/src/__tests__/persistence.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/persistence.test.ts)
- [x] **P0-J**: 門清一摸三鎖定 3 台 — 自摸且無副露時給予門清一摸三 (3 台)，互斥排除自摸(1)+門清(1)。
  - 測試檔：[`apps/server/src/__tests__/p0-spec-compliance.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/p0-spec-compliance.test.ts), [`packages/rules/src/__tests__/scoring.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/scoring.test.ts)
- [x] **P0-K**: Stake-Compliant Provably Fair (可證明公平性) 種子序與承諾驗證機制 — 256-bit CSPRNG 秘密伺服器種子 + SHA-256 承諾廣播 + HMAC-SHA256 確定性每局衍生 + 結算開牌驗證與 100% 牌局重放。
  - 測試檔：[`packages/rules/src/__tests__/provably-fair.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/provably-fair.test.ts), [`apps/server/src/__tests__/provably-fair-server.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/provably-fair-server.test.ts)
- [x] **P0-L**: 聽牌與打牌進張分析提示 (Tenpai Wait-Tile Overlay) — 即時計算手牌打出後的牌效、向聽數與全場剩餘張數。
  - 測試檔：[`packages/rules/src/__tests__/wait.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/packages/rules/src/__tests__/wait.test.ts), [`apps/server/src/__tests__/provably-fair-server.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/provably-fair-server.test.ts)
- [x] **P0-M**: 雀魂 (Mahjong Soul) 高質感黑金大廳與結算開牌驗證工具 — 包含三大模式卡片、段位戰、好友房、AI 修煉場與獨立 `/verify` 稽核工具頁。
- [x] **P0-N**: 確定性歷史牌譜覆盤系統 (Match Replay Engine) — 完整記錄每局 4 家初始手牌、開門骰子、種子承諾與全時序捨牌/副露/摸牌/結算步驟，支援事後復盤與防作弊審計。
  - 測試檔：[`apps/server/src/__tests__/replay.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/replay.test.ts)
- [x] **P0-O**: 雀魂風四家即時點數 (🪙 25,000) 與手機端滑動出牌 (Mobile Swipe-to-Discard) — 支援觸控螢幕向上滑動出牌手勢與動態呼吸燈。
  - 測試檔：[`apps/player-client/qa_render_check.gd`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/player-client/qa_render_check.gd)
- [x] **P1**: 領域規則對齊規格 — 吃碰槓領域契約、標準 5 組+將、八對子（7對+1刻=17張）、骰子定門 (`TAIWAN_WALL_OPENING_V1`)、連續補花 (`IMMEDIATE_TAIL_CHAIN_V1`)。
- [x] **P2**: 房間狀態機 — 過水獨立維護、優先序 胡 > 槓/碰 > 吃、逾時摸切/過牌、Client-Safe Snapshot 遮蔽、SQLite WAL 單實例持久化與重啟 RNG 重放。
  - 測試檔：[`apps/server/src/__tests__/persistence.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/persistence.test.ts)
- [x] **P3**: Godot 4.7 Client-Safe UI — 零本地判斷、純表現層、重連攜帶 `playerId` + `seatCredential` + `generationId`、第 17 張以伺服器 `lastDrawnTile` 分離。
  - 測試檔：[`apps/player-client/qa_render_check.gd`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/player-client/qa_render_check.gd)
- [x] **P4**: 黃金測試案例 (GC-01 ~ GC-43) 全部鎖定並通過。

---

## Not done
- **UI 額外 3D 特效與大型音畫包**：依據硬性約束第 3 條與 P3 最小迴路要求，保持 Client-Safe 純表現層與 headless QA 測試 100% 通過，確保輕量化 Web 載入速度。

---

## Tests after（N pass / 0 fail）
- **TypeScript / Vitest**: **18 passed / 18 test files** (**268 passed / 0 failed**, 1.7s)
- **Typecheck**: `pnpm typecheck` **0 errors**
- **Build**: `pnpm build` **0 errors**
- **Godot Headless QA**: **58 passed / 0 failed**
- **50,000-Hand (五萬局 / 280 萬步決策) 大規模 AI 自我對弈與全牌型不變式基準測試**:
  - **總耗時**: 6694.46 秒 (**7.5 局/秒**)
  - **總局數**: 50,000 局 (48,291 勝 [96.58%] / 1,709 流局 [3.42%])
  - **平均每局回合數**: 55.7 回合 (總計約 **2,785,000 步決策**)
  - **最高連莊**: 連 11 莊
  - **零和性違規**: **0 次 (PASS - 50,000 局 100% sum(delta) === 0)**
  - **牌山張數違規**: **0 次 (PASS - 2,785,000 步 100% 144 張守恆)**
  - **可證明公平性違規**: **0 次 (PASS - 50,000 局 100% SHA256/HMAC 承諾開牌驗證通過)**
  - **AI 勝率表現**: 初級 0.96% (478勝) vs 中級 23.51% (11,753勝) vs 高級 72.12% (36,060勝)
  - **完整役種與特殊罕見牌型統計 (48,291 次胡牌)**:
    - 花牌: 15,921 次 (32.97%)
    - 自摸: 9,812 次 (20.32%)
    - 坎張: 8,756 次 (18.13%)
    - 莊家連莊台: 5,498 次 (11.39%)
    - 邊張: 5,011 次 (10.38%)
    - 門清: 2,836 次 (5.87%)
    - 單吊: 2,405 次 (4.98%)
    - 平胡: 832 次 (1.72%)
    - 門清一摸三: 781 次 (1.62%)
    - 全求人: 627 次 (1.30%)
    - 三暗刻: 341 次 (0.71%)
    - 槓上開花: 140 次 (0.29%)
    - 河底撈魚: 136 次 (0.28%)
    - 搶槓: 113 次 (0.23%)
    - 碰碰胡: 76 次 (0.16%)
    - 混一色: 53 次 (0.11%)
    - 海底撈月: 47 次 (0.10%)
    - 四暗刻: 21 次 (0.04%)
    - 小三元: 8 次 (0.02%)
    - 大三元: 8 次 (0.02%)

---

## Residual risks
1. **單實例 SQLite 架構約束**：`SqliteRoomRepository` 嚴格約束為單伺服器實例重啟還原與崩潰恢復，不支援多進程 active-active 同時並發寫入同一個 SQLite 檔案。未來若需水平擴展，需在反向代理層使用基於 `roomId` 的 Sticky Routing。
2. **網路抖動與 AI 延遲窗口**：AI 反應延遲設計為 1.5s ~ 2.6s，確保人類玩家在反應窗開啟時有足夠時間點擊吃/碰/過。

---

## How to run

### 1. 安裝與測試
```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

### 2. 執行高並發 AI 自我對弈基準測試 (支援自訂局數，如 100, 1000, 10000)
```bash
pnpm benchmark 10000
```

### 3. 執行 Godot 客戶端渲染 QA 檢查
```bash
/Users/ian/Downloads/Godot.app/Contents/MacOS/Godot --headless --path apps/player-client res://qa_render_check.tscn
```

### 4. 本地啟動伺服器
```bash
pnpm dev
# 或啟動帶 Web Client 的靜態服務
pnpm dev:web
```
