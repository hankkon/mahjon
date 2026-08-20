# AI 自主迭代紀錄 (AI Iteration Log)

- **執行日期**：2026-08-20
- **工作範圍**：低風險穩定性、模組可維護性、Godot 客戶端 UI 品質提升

---

## 輪次 1：`table.gd` 冗餘手牌代碼清理與 View 委派收斂

- **問題**：
  先前將手牌渲染邏輯抽換至 `HandView.gd` 後，`table.gd` 仍殘留約 130 行未使用的手牌操作舊函式（`_render_draw_spacer`、`_rebuild_hand_sync`、`_apply_playability_all`、`_animate_hand_reflow`），造成維護混淆與潛在代碼漂移風險。
- **修改檔案**：
  - `apps/player-client/scripts/table.gd`
- **修改內容**：
  - 移除 `table.gd` 內冗餘的手牌建構與理牌動畫舊函式。
  - 保留 `_create_tile_button`、`_apply_tile_extras`、`_sorted_hand` 與 `_split_drawn_tile` 作為 View 與 QA 測試相容轉發介面。
- **驗證結果**：
  - `pnpm test`：163/163 PASS
  - `pnpm typecheck`：Done（零型別錯誤）
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 2：四家副露中文標籤與連莊標記視覺品質提升

- **問題**：
  `SeatPanelsView.gd` 渲染各家副露時原先顯示英文鍵值（`[chi]`、`[peng]`、`[kong]`），且座位標籤只顯示單純 `[莊]`，未在座位面板直接標示目前連莊次數。
- **修改檔案**：
  - `apps/player-client/scripts/ui/SeatPanelsView.gd`
- **修改內容**：
  - 新增 `MELD_CN` 映射字典，將副露類型本地化為 `[吃]`、`[碰]`、`[槓]`、`[暗槓]`、`[補槓]`。
  - 當莊家連莊數 > 0 時，座位標籤以 `[莊·連%d]` 格式清晰標註。
- **驗證結果**：
  - `pnpm test`：163/163 PASS
  - `pnpm typecheck`：Done（零型別錯誤）
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 3：棄牌河高亮邏輯封裝至 `RiverView.gd` 與色彩殘留防禦

- **問題**：
  `_highlight_discard_matches` 原直接在 `table.gd` 遍歷所有河槽並手動修改 `modulate` 色彩；且在河槽刷新（`refresh`）或隱藏（`hide_all`）時，若槽位未重置 `modulate`，可能在次局殘留前一手選牌的染色。
- **修改檔案**：
  - `apps/player-client/scripts/ui/RiverView.gd`
  - `apps/player-client/scripts/table.gd`
- **修改內容**：
  - 在 `RiverView.gd` 新增 `highlight_matches(selected_tile_id: String)`，將高亮染色的職責內聚於 RiverView。
  - 在 `RiverView.gd` 的 `refresh()` 與 `hide_all()` 補充 `tr.modulate = Color(1.0, 1.0, 1.0, 1.0)` 重置邏輯。
  - `table.gd` 的 `_highlight_discard_matches` 委派給 `river_view.highlight_matches`。
- **驗證結果**：
  - `pnpm test`：163/163 PASS
  - `pnpm typecheck`：Done（零型別錯誤）
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 4：南部麻將（136 張無花牌）伺服器端變體驗證套件

- **問題**：
  伺服器與規則引擎雖具備 `VARIANT=south`，但先前單元測試未在 `room.test.ts` 建立專屬變體驗證測試（136 總牌數、發牌 16/17、零花牌與 16 尾牌不變式）。
- **修改檔案**：
  - `apps/server/src/__tests__/room.test.ts`
- **修改內容**：
  - 新增 `Southern Mahjong (variant: south)` 測試，完整鎖定 136 牌初始發牌 65 張、剩餘牆牌 55 張、尾牌 16 張與零花牌判定。
- **驗證結果**：
  - `pnpm test`：164/164 PASS
  - `pnpm typecheck`：Done
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 5：`AnimationQueue` 清空狀態重置與 Tween 實例有效性防禦

- **問題**：
  在場景切換或呼叫 `AnimationQueue.clear()` 時，未將 `_playing` 旗標重置為 `false`；若動畫 Tween 被銷毀而未發出 `finished`，可能導致 `is_playing()` 殘留為 `true` 並永久鎖定手牌輸入。且 `_advance` 缺乏 `is_instance_valid(tween)` 守衛。
- **修改檔案**：
  - `apps/player-client/scripts/AnimationQueue.gd`
- **修改內容**：
  - `clear()` 內加入 `_playing = false` 重置。
  - `_advance()` 增加 `tween is Tween and is_instance_valid(tween) and tween.is_valid()` 多重型別與有效性守衛。
- **驗證結果**：
  - `pnpm test`：164/164 PASS
  - `pnpm typecheck`：Done
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 6：`main.gd` 輸入框 Enter 鍵快捷提交支援

- **問題**：
  在登入與開房大廳畫面中，輸入玩家名稱或房間代碼後按鍵盤 Enter（`text_submitted`）未自動觸發保存或加入操作，玩家必須手動用滑鼠點選「加入」按鈕。
- **修改檔案**：
  - `apps/player-client/scripts/main.gd`
- **修改內容**：
  - 在 `_ready()` 中綁定 `room_edit.text_submitted` 觸發 `_on_join_pressed()`，以及 `name_edit.text_submitted` 觸發 `_apply_prefs()`。
- **驗證結果**：
  - `pnpm test`：164/164 PASS
  - `pnpm typecheck`：Done
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 輪次 7：明星三缺一/雀魂 台灣牌桌體驗全面升級（中央羅盤骰盅風向盤 + 輪到我強烈提示 + 提示音）

- **問題**：
  牌桌缺乏明確的「當前回合/輪到我出牌」焦點指示，玩家無法直觀判斷目前由哪一家思考，且牌桌中央缺少經典台灣麻將的風位骰盅盤與即時出牌指引橫幅。
- **修改檔案**：
  - `apps/player-client/scenes/Table.tscn`
  - `apps/player-client/scripts/table.gd`
  - `apps/player-client/scripts/AudioManager.gd`
  - `apps/player-client/scripts/ui/SeatPanelsView.gd`
- **修改內容**：
  - **中央羅盤風向盤 (`CenterCompass`)**：嵌入黑金漆藝風向盤，呈現圈風局數（如「東風 第1局」）、中央大字倒數秒數、牌牆餘牌與東南西北四向指引箭頭（`▲ 北`、`▼ 南 (我)`、`◀ 西`、`東 ▶`），輪到的方位即時高亮金色光效。
  - **出牌提示橫幅 (`TurnBanner`)**：手牌區上方加入動態提示橫幅，輪到我時以醒目金字提示「👉【輪到您出牌】請點選手牌打出」，等待他人時顯示「等待【玩家名】出牌中…」，反應視窗顯示「⚡【請選擇】吃 / 碰 / 槓 / 過」。
  - **回合提示音效 (`play_turn_start`)**：在 `AudioManager.gd` 內新增程式化雙音和弦提示音，輪到我方出牌瞬間自動撥放，第一時間提醒玩家。
  - **四家座位面板輪到高亮**：當前出牌玩家面板套用金色光芒外框、加厚描邊與「👈 輪到你」/「👉 出牌中」動態標籤。
  - **Web 匯出更新**：同步重新編譯發布 Godot Web 版產物至 `export/web/`。
- **驗證結果**：
  - `pnpm test`：164/164 PASS
  - `pnpm typecheck`：Done
  - Godot Headless：58/58 PASS
- **未解風險**：無。

---

## 總結

各輪低風險改善皆完成並驗證通過。所有單元測試（164 項）與 Godot headless 渲染測試（58 項）保持 100% 綠燈，未改動任何後端權威邏輯、通訊協議或計分規則。



