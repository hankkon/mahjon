# 全功能地端 E2E 實機綜合測試報告

- **日期**：2026-08-11
- **環境**：macOS / pnpm monorepo（`taiwan-mahjong1`）/ Godot 4.7.1 headless
- **伺服器**：地端 WebSocket `ws://localhost:3000/ws`，`TIMEOUT_MS=15000`（15 秒正常思考時間）
- **驗證範圍**：情境 A / B / C / D × 伺服器端（權威邏輯）+ 客戶端（Godot UI 渲染）

---

## 一、總覽

| 層級 | 工具 | 結果 | 說明 |
|---|---|---|---|
| 伺服器端 | [`qa-e2e.ts`](apps/server/src/scripts/qa-e2e.ts) | **29 / 29 PASS** | 4 真實玩家 bot 連線，完整跑 4 情境 |
| 客戶端 UI | [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) + [`qa_render_check.tscn`](apps/player-client/qa_render_check.tscn) | **14 / 14 PASS** | headless 載入真實 `Table.tscn` 注入伺服器形狀快照 |
| 服務健康度 | `GET /health` | `ok:true` | 全程監測，無中斷 |

---

## 二、情境 A【標準完整流程】— 伺服器端 15/15 PASS

4 視窗連線 → 入座 → 準備 → 自動發牌 → 輪流摸打 → 自動胡牌結算 → 「準備下一局」重置。

驗證項目（節錄）：
- 4 家座位依序為 `[0,1,2,3]`，無重複
- 發牌後閒家手牌 16 張、莊家 17 張（台灣 16 張制；莊家持 17 張進張，
  `packages/rules/src/wall.ts` `dealInitial` 先發 4 輪 × 4 = 各 16 張，
  再補莊家第 17 張）
- 補花後手牌張數維持此量級（花牌進 `flowers`，不佔手牌）
- 每局 `game.started` 只記 1 次（以 bot A 為準，避免廣播重複計數）
- 每局 `game.ended` 正常觸發，`winner` / `dealer` / `ledger` 齊全
- 4 局完整跑完，每局 4 家 ledger delta 總和 = 0（零和）
- 「準備下一局」後 `status` 回到 `lobby`，再發下一局

---

## 三、情境 B【吃/碰/槓與動畫佇列】— 伺服器端 5/5 PASS

- 整場共產生 **19 次副露**（吃 6、碰 12、槓 1）
- 每局副露張數 ≥ 1；追蹤各家 `melds` 數量與種類正確
- 副露後手牌張數正確遞減（碰/槓 3 張一組）
- 客戶端 UI（見第六節）：動畫播放期間手牌按鈕鎖定、反應列隱藏、佇列清空後恢復

---

## 四、情境 C【逾時與託管恢復】— 伺服器端 2/2 PASS

- 刻意閒置超過 15 秒 → 伺服器自動**摸切**（`autoplayLog` 記錄 `reason: "timeout"`）
- 對應玩家 `autoplay` 旗標 = true，快照帶 `⚠託管中`
- 手動再點棄牌 → 玩家恢復手動控制，`autoplay` 旗標清除
- 客戶端 UI（見第六節）：倒數文字轉紅（≤5s）、側邊面板 ⚠託管中、狀態列「你已自動託管（伺服器代打）」

---

## 五、情境 D【連莊與結算帳本】— 伺服器端 7/7 PASS

- **莊家連胡 2 局** → `dealerStreak` 達 3，連莊台成立（破壞牌模式：其餘三家故意拆牌讓莊家自摸）
- 結算台數明細含 `莊家連莊台 +2`（streak=3 → 連莊加成 2 台）
- 四家 ledger delta 精確：莊 +900、其餘 -300，總和 = 0
- 莊家輪替不變式：非莊家胡牌 → 下一位莊家且 streak 歸零
- 客戶端 UI（見第六節）：結算面板含連莊加成、TopBar「連莊 3」、四家 delta 顯示

---

## 六、客戶端 UI 驗證（headless Godot）— 14/14 PASS

透過 [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) 載入真實 [`Table.tscn`](apps/player-client/scenes/Table.tscn)，以 `GameState.apply_snapshot()` 注入伺服器形狀快照：

| 情境 | 檢查點 | 結果 |
|---|---|---|
| B | 發牌 15 張 → 15 顆手牌按鈕 | ✅ |
| B | 摸牌快照（16 張）→ 動畫佇列播放 | ✅ |
| B | 動畫播放期間手牌輸入鎖定 | ✅ |
| B | 動畫播放期間反應列隱藏 | ✅ |
| B | 動畫佇列清空後恢復（58 幀內） | ✅ |
| B | 動畫結束後手牌輸入解鎖 | ✅ |
| C | 託管中倒數文字轉紅（`e63333ff`） | ✅ |
| C | 側邊面板顯示 ⚠託管中 | ✅ |
| C | 狀態列「你已自動託管（伺服器代打）」 | ✅ |
| D | 結算面板顯示 | ✅ |
| D | 台數明細含「莊家連莊台 +2」與「連莊加成」 | ✅ |
| D | 四家 ledger delta（+900 / -300）顯示 | ✅ |
| D | TopBar「東風 莊家 A（連莊 3）」 | ✅ |
| D | 「準備下一局」按鈕可用 | ✅ |

---

## 七、測試中發現並修正的問題

### 1. 伺服器端
| 問題 | 根因 | 修正 |
|---|---|---|
| Bot A 永遠坐不到位（seat=-1）→ 第 1 局卡死 | 房主只收到 `welcome` + `room.created`，**沒有** `player.joined` | 從 `snapshot.you` 推導座位（`qa-e2e.ts`） |
| `game.started` 計數 ×4 膨脹 | 4 家都會收到 `game.started` 廣播 | 只在 bot A 計數 |
| 全部流局、無真實胡牌 | bot 亂棄牌 | 勝率導向棄牌策略 + 破壞牌模式（讓莊家連胡） |

### 2. 客戶端（真實 bug！）
| 問題 | 根因 | 修正 |
|---|---|---|
| **動畫佇列無限迴圈**：摸牌動畫播完 → 又排入相同摸牌 job → 手牌永遠鎖定、畫面跳動 | `_on_queue_drained()` 呼叫 `_refresh()` 重跑 `_collect_anim_jobs()`，但 `_last_hand` 未更新（只有 `_render_final_state()` 會更新），同一 diff（16>15）被無限重複排入 | [`table.gd`](apps/player-client/scripts/table.gd:178)：佇列清空後改直接呼叫 `_render_final_state()` 更新 diff 基準（非 playing 狀態仍走 `_refresh()` 轉場） |
| 測試 harness `process_frame` 未定義 | `--script` 模式不載入 autoload + 語法錯誤 | 改用 `await get_tree().process_frame` + 改以場景執行 |

---

## 八、驗證用的產物

| 檔案 | 用途 |
|---|---|
| [`apps/server/src/scripts/qa-e2e.ts`](apps/server/src/scripts/qa-e2e.ts) | 伺服器端 4-bot E2E（29 檢查點） |
| [`apps/player-client/qa_render_check.gd`](apps/player-client/qa_render_check.gd) | 客戶端 UI 驗證 harness（14 檢查點） |
| [`apps/player-client/qa_render_check.tscn`](apps/player-client/qa_render_check.tscn) | harness 場景（autoload 載入用） |

## 九、執行方式（重現）

```bash
# 1. 啟動伺服器（Terminal 1）
cd taiwan-mahjong1
TIMEOUT_MS=15000 pnpm --filter @taiwan-mahjong/server serve

# 2. 伺服器端 E2E（Terminal 2）
pnpm --filter @taiwan-mahjong/server e2e

# 3. 客戶端 UI 驗證（Terminal 2）
/Users/ian/Downloads/Godot.app/Contents/MacOS/Godot --headless \
  --path apps/player-client res://qa_render_check.tscn
# Exit code 0 = 全 PASS
```

---

**結論：伺服器端 29/29 + 客戶端 UI 14/14 全數通過；測試過程中修復 1 個真實客戶端動畫無限迴圈 bug（table.gd），並確認 15 秒逾時託管、連莊台、結算帳本零和等關鍵機制正確。**
