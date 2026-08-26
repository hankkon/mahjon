# AI 自主迭代紀錄 (AI Iteration Log)

- **執行日期**：2026-08-26
- **工作範圍**：向聽數與牌效啟發式 AI 決策引擎防守增強、伺服器定時房間清理排程、/health 指標強化、1,000 局高並發自我對弈基準測試與不變式證明

---

## 輪次 12：向聽數防守強化、房間自動清理排程、1,000 局自我對弈基準測試

- **問題**：
  1. `RoomManager.cleanup()` 需外部呼叫，缺乏背景週期性清理排程（長期運作可能累積廢棄房間）。
  2. `aiPlayer.ts` 中 `allDiscards` 收集有誤（誤將 flat array 判斷為 2D array），且 `deckRemaining` 與 `headRemaining` 混用，導致防守決策與棄牌池現物判斷失真。
  3. 缺乏一鍵執行 1,000 局大規模 AI 自我對弈並自動驗證零和性與 144 張牌山恆等式的基準測試工具。

- **修改檔案**：
  - `apps/server/src/index.ts` & `config.ts`（新增 `cleanupIntervalMs` 背景排程與 `/health` playingRooms/totalCleanedRooms 指標）
  - `apps/server/src/aiPlayer.ts`（修復 `allDiscards` 收集、使用 `headRemaining` 判定殘壁防守、強化現物安牌 defenseScore、使 `countUnseen` 支援各種輸入形狀）
  - `packages/rules/src/game.ts`（新增並導出 `accountedGameStateTiles`，精確計算對局中 hands+flowers+melds+discards+wall 的 144/136 張恆等式）
  - `apps/server/src/scripts/benchmark-simulation.ts`（全新 1,000 局高速自我對弈基準測試腳本，支援勝率統計、役種頻率與不變式檢查）
  - `apps/server/package.json` & `package.json`（新增 `pnpm benchmark` 指令）
  - `OVERNIGHT_REPORT.md`（更新 1,000 局測試數據）

- **驗證結果**：
  - `pnpm benchmark 1000`：**1,000 局完成 (134.3s, 7.4 局/秒)**
    - 零和性違規 (`sum(delta) !== 0`)：**0 次** (PASS)
    - 牌山張數違規 (`accountedGameStateTiles !== 144`)：**0 次** (PASS)
    - AI 勝率表現：初級 0.5% vs 中級 23.1% vs 高級 72.6% (勝率隨難度梯度分明)
  - `pnpm test`：**256/256 PASS**（15 個測試檔案全數通過）
  - `pnpm typecheck`：**Done**（零型別錯誤）
  - `pnpm build`：**Done**（編譯成功）
  - Godot Headless QA Check (`qa_render_check.tscn`)：**PASS 58 / FAIL 0**

---

## 輪次 11：P0-A ~ P0-J 正確性收斂、狀態機嚴格對齊、全量規格驗證

- **問題**：
  1. `Room.startGame()` 內部有 `this.scores = [0,0,0,0]`，導致多局連打時總分遭歸零（P0-A）。
  2. `finishWin()` 結算與算台先執行輪莊/連莊再組裝 `WinContext`，導致閒家胡牌換莊後 `diHu` 誤判為 false、`zhengHua` 正花判斷採用下一局莊家（P0-B）。
  3. 一砲多響與搶槓多響需確保零和性，且 `qiangKongAll` 需支援所有符合胡牌條件者同時宣告（P0-C, P0-D）。
  4. `handleCommand` 中 `operationId` 冪等性重試需先於 stale generation 檢查，以允許網路瞬斷重試（P0-I）。
  5. 缺少單一整合驗證 P0-A ~ P0-J 規範的專屬回歸測試套件。

- **修改檔案**：
  - `apps/server/src/room.ts`（移除 `startGame` 中的 scores 歸零、修正 `finishWin` 莊家時序、支援 `qiangKongAll` 多人搶槓、調整 `operationId` 冪等性重試先於 stale generation 檢查）
  - `packages/rules/src/kong.ts`（新增 `qiangKongAll`，`qiangKong` 保持短路向後相容）
  - `packages/rules/src/win.ts`（確保花牌不可作為手牌或胡牌構成）
  - `apps/server/src/__tests__/p0-spec-compliance.test.ts`（全新 P0-A ~ P0-J 專屬完整規格與回歸測試套件）
  - `apps/server/src/__tests__/persistence.test.ts`（新增重啟還原後下一局洗牌/發牌完全重放確定性測試）
  - `OVERNIGHT_REPORT.md`（完整過夜開發報告）

- **驗證結果**：
  - `pnpm test`：**256/256 PASS**（15 個測試檔案全數通過，1.3s）
  - `pnpm typecheck`：**Done**（零型別錯誤）
  - `pnpm build`：**Done**（編譯成功）
  - Godot Headless QA Check (`qa_render_check.tscn`)：**PASS 58 / FAIL 0**

---

## 輪次 10：CI 升級、WSS 通訊防護強化、SQLite 單實例持久化明確化

- **問題**：
  1. `.github/workflows/ci.yml` 使用 Node 20 與 pnpm 9，與專案 packageManager (pnpm 11) 及 engines (Node >=22.5) 不一致，且遺漏 `pnpm build` 檢查。
  2. `apps/server/src/wss.ts` 缺乏連線速率限制、訊息最大長度限制、結構化欄位檢查，且遭遇惡意或格式錯誤封包時可能無限回傳錯誤，造成伺服器 CPU/頻寬耗損。
  3. `apps/server/src/roomManager.ts` 在 SQLite 持久化中假裝支援多程序並發（CAS 失敗後直接覆寫），未明確界定為單實例權威模型。
  4. `.gitignore` 缺少 `.godot/` 根目錄、打包生成的 zip 檔、`repomix-output.md` 與 sqlite 暫存檔等規則。

- **修改檔案**：
  - `.github/workflows/ci.yml`（Node 22.x、pnpm 11、`pnpm/action-setup@v4`、加入 `pnpm build`）
  - `apps/server/src/protocol.ts`（新增 `validateClientCommand`，嚴格檢查欄位長度、型別與範圍）
  - `apps/server/src/wss.ts`（加入 `maxPayloadBytes` 64KB、每連線指令速率限制、有效負載大小與欄位驗證、錯誤降頻發送與過量錯誤中斷連線）
  - `apps/server/src/index.ts`（`ServerConfig` 支援 WSS 防護參數透傳）
  - `apps/server/src/roomManager.ts`（明確化單實例權威持久化模型，移除虛假的多程序並發註解與 CAS 覆寫）
  - `apps/server/src/sqlite.ts`（加入 `closed` 狀態防護，避免關閉後非同步回呼存取報錯）
  - `docs/spec.md`（更新 §5.1 明確記錄 SQLite Persistence 僅供單伺服器實例重啟/崩潰還原使用）
  - `.gitignore`（補齊 `.godot/`、`*.zip`、`repomix-output.md`、`*.sqlite*`）
  - 測試：`apps/server/src/__tests__/wss.test.ts`（新增非 JSON、不合法指令欄位、速率限制、超大負載、過量錯誤降頻與斷線測試）、`apps/server/src/__tests__/persistence.test.ts`（單實例持續狀態保存測試）

- **驗證結果**：
  - `pnpm test`：**243/243 PASS**（14 個測試檔案全數通過）
  - `pnpm typecheck`：**Done**（零型別錯誤）
  - `pnpm build`：**Done**（Monorepo 編譯成功）
  - Godot Headless QA Check：**PASS 58 / FAIL 0**

- **未解風險與建議**：
  - 目前 SQLite 專責單實例耐久化（重啟還原），若未來需擴展為多實例 active-active，需採用 Room ID Sticky Routing（房間分流）或分散式協調器。
  - Git index 中先前已追蹤 `apps/player-client/.godot/editor/...` 檔案，建議使用者後續可視需要執行 `git rm -r --cached apps/player-client/.godot` 以將其從版本控制中排除（本地檔案不受影響）。

---

## 輪次 9：伺服器工程防護層移植（持久化 / 憑證 / 防重放 / CAS）

- **問題**：伺服器全記憶體、無驗證，重啟即丟牌局；任誰都能猜 playerId
  佔別人座位；`operationId` 去重只存記憶體且不驗證內容。
- **修改檔案**：
  - `packages/rules/src/rng.ts`（`SeededRng.getState()/fromState()` 精確續接）
  - `apps/server/src/{repository,sqlite,seat-credential,config}.ts`（新增）
  - `apps/server/src/room.ts`（`serialize()/restore()`、fingerprint 去重）
  - `apps/server/src/roomManager.ts`（repository 接線 + CAS + loadPersisted）
  - `apps/server/src/wss.ts`（憑證發行/驗證/rotation、伺服器端心跳）
  - `apps/server/src/{index,serve,serve-web}.ts`（SQLITE_PATH / SECRET /
    HEARTBEAT env、`GAME_SERVER_READY` 生命週期事件）
  - `apps/server/src/protocol.ts`（join 帶 `seatCredential`、事件回傳）
  - `apps/player-client/scripts/NetworkManager.gd`（儲存並重連送出憑證）
  - `Dockerfile`（`/data` volume + SQLITE_PATH）、`.env.example`
  - 測試：`persistence.test.ts`、`seat-credential.test.ts`
  - `docs/spec.md`（§5 持久化與憑證）
- **修改內容**：
  - SQLite（`node:sqlite`，WAL）：每個 room mutation 持久化快照，
    重啟後 `loadPersisted()` 還原並暫停計時，玩家重連即續。
  - `operationId → 內容指紋`：同 ID 不同 payload → `command_id_reused` 拒絕；
    指紋隨快照持久化，崩潰重放也安全。
  - HMAC 座位憑證（TTL + rotation）：重連需有效憑證，防佔位。
  - 樂觀並發：`UPDATE … WHERE generation_id = ?`（CAS）。
  - `GAME_SERVER_READY` JSON 行 + 伺服器端心跳。
- **驗證結果**：
  - `pnpm test`：**238/238 PASS**（新增 21 項：persistence 14 + credential 7）
  - `pnpm typecheck` / `pnpm build`：Done
  - **端到端煙霧測試**：開房 → 發憑證 → 殺伺服器 → 同 SQLite 重啟 →
    無憑證重連被拒、帶憑證重連座位還原 ✅
- **未解風險**：
  - 多程序部署的 CAS 衝突回退是「重新整筆覆寫」；真正需要多實例時
    應改為「重載後重放未套用指令」。
  - 憑證 generation 在重啟後歸零（僅影響 rotation 後未重連的舊憑證）。

---

- **執行日期**：2026-08-23
- **工作範圍**：整合參考實作（朋友的 Taiwan V1 平台）的麻將規則與伺服器接線

---

## 輪次 8：整合參考實作的台灣規則（骰子定門 / 等待分析 / 台數定案 / 伺服器接線）

- **問題**：
  1. `門清一摸三` 疊加語意（5 台）為「規則待確認」；參考實作已依
     GameTower 牌例定案為「互斥取高」（門清自摸 = 3 台）。
  2. 缺少骰子定門、邊張/坎張/單吊、平胡、全求人、三·四·五暗刻分級、河底撈魚。
  3. `finishWin` 未把胡牌張、花牌、天胡/地胡/海底撈月/河底撈魚/搶槓
     傳入計分 context——這些規則在真實對局從未觸發；放槍胡時計分拿到的
     `hand` 也缺胡牌張（16 張而非完整 17 張）。

- **修改檔案**：
  - `packages/rules/src/dice.ts`（新增：三骰驗證與 `rollDice`）
  - `packages/rules/src/wait.ts`（新增：聽牌張 + 胡牌張角色分析、分解枚舉）
  - `packages/rules/src/wall.ts`（新增 `applyWallOpening` 骰子定門）
  - `packages/rules/src/game.ts`（`createGameState` 支援骰子）
  - `packages/rules/src/scoring.ts`（台數矩陣升級 + 互斥取高）
  - `packages/rules/src/index.ts`（匯出 dice/wait）
  - `apps/server/src/room.ts`（每手擲骰、天胡起手檢查、finishWin 完整接線）
  - `packages/rules/src/__tests__/{scoring,wall-opening,dice,wait}.test.ts`
  - `apps/server/src/__tests__/room.test.ts`（golden 更新 + fixture 花牌清理）
  - `docs/spec.md`（2.2.1 骰子定門、2.5.1 台數矩陣、2.5.2 已定案）

- **修改內容**：
  - 門清一摸三改為取代自摸+門清（3 台），同步更新 golden 測試。
  - 新增 平胡(2)、全求人(2)、邊張/坎張/單吊(1，僅北部)、三/四/五暗刻(2/5/8)、
    河底撈魚(1)、天胡 24 台；五暗刻取代碰碰胡/門清，四暗刻取代三暗刻。
  - 骰子定門：`openingSeat = dealer + (total−1) mod 4`，斷牌點後依序取牌，
    尾 16 張不變（雙游標模型維持）。
  - room `finishWin` 現在傳入完整 17 張胡牌手牌、胡牌張、花牌，並正確標記
    天胡/地胡/海底撈月/河底撈魚/搶槓。

- **驗證結果**：
  - `pnpm test`：**217/217 PASS**（新增 32 項測試）
  - `pnpm typecheck`：Done（零型別錯誤）
- **未解風險**：
  - 八仙過海/七搶一仍是「花牌台」附加在一般胡牌上；參考實作的「花牌即胡、
    特定付款模式」尚未實作（付款模式需改 ledger 結構）。
  - 南部變體不計邊/坎/單吊，平胡在南部不受其排除——已按參考實作。

---

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



