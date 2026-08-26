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
- [x] **P1**: 領域規則對齊規格 — 吃碰槓領域契約、標準 5 組+將、八對子（7對+1刻=17張）、骰子定門 (`TAIWAN_WALL_OPENING_V1`)、連續補花 (`IMMEDIATE_TAIL_CHAIN_V1`)。
- [x] **P2**: 房間狀態機 — 過水獨立維護、優先序 胡 > 槓/碰 > 吃、逾時摸切/過牌、Client-Safe Snapshot 遮蔽、SQLite WAL 單實例持久化與重啟 RNG 重放。
  - 測試檔：[`apps/server/src/__tests__/persistence.test.ts`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/server/src/__tests__/persistence.test.ts)
- [x] **P3**: Godot 4.7 Client-Safe UI — 零本地判斷、純表現層、重連攜帶 `playerId` + `seatCredential` + `generationId`、第 17 張以伺服器 `lastDrawnTile` 分離。
  - 測試檔：[`apps/player-client/qa_render_check.gd`](file:///Users/ian/Desktop/taiwan-mahjong1/apps/player-client/qa_render_check.gd)
- [x] **P4**: 黃金測試案例 (GC-01 ~ GC-43) 全部鎖定並通過。

---

## Not done
- **UI 額外 3D 特效與皮膚大工程**：依據硬性約束第 3 條與 P3 最小迴路要求，保持 Client-Safe 純表現層與 headless QA 測試 100% 通過，不引入額外不穩定資源。

---

## Tests after（N pass / 0 fail）
- **TypeScript / Vitest**: **15 passed / 15 test files** (**256 passed / 0 failed**, 1.3s)
- **Typecheck**: `pnpm typecheck` **0 errors**
- **Build**: `pnpm build` **0 errors**
- **Godot Headless QA**: **58 passed / 0 failed**
- **1,000-Hand Autonomous AI Self-Play Benchmark**:
  - **總耗時**: 134.3 秒 (**7.4 局/秒**)
  - **總局數**: 1,000 局 (962 勝 / 38 流局)
  - **零和性違規**: **0 次 (PASS - sum(delta) === 0)**
  - **牌山張數違規**: **0 次 (PASS - 144 張恆等式)**
  - **AI 勝率**: 初級 0.5% vs 中級 23.1% vs 高級 72.6% (證明向聽數與防守演算法發揮效果)

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

### 2. 執行 1,000 局高並發 AI 自我對弈基準測試
```bash
pnpm benchmark 1000
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
