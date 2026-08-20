# 硬核修復報告 HARD_FIX_REPORT

## 改動文件清單

### 1. `apps/player-client/scripts/table.gd` — 2 處 Godot 生命週期竟態
- **`_animate_hand_reflow`**：`await get_tree().process_frame` 後加 `if not is_inside_tree(): return`。
  理由：void 非同步函數，場景切換時節點已出樹，後續 `hand_area.get_children()` 崩潰。
- **`_animate_settlement_line`**：guard 改為 `if not is_inside_tree() or not is_instance_valid(lbl) or ...`。
  理由：流局/勝利結算動畫期間若玩家離場，`self` 已出樹，`create_tween()` 會抛異常。

### 2. `apps/player-client/qa_render_check.gd` — 情境 NULL-SNAP（7 個新斷言）
- 覆蓋所有 nullable 字段皆為 `null` 時 `apply_snapshot` 不崩潰。
- 確認各字段落地為 sentinel 值（-1 / []），避免 nil→typed 崩潰。
- 重複流局快照測試（settlement.winner=null），與既有 DRAW 情境互為冗餘鎖定。

### 3. `packages/rules/src/__tests__/scoring.test.ts` — GC-42 / GC-43（2 個新測試）
- **GC-42**：放槍者也是胡家之一退化 case → `sum(delta) === 0`，放槍兼胡家 delta ≥ 0。
- **GC-43**：單胡家 `settleMultiLedger([ctx])` 與 `settleLedger(ctx)` 結果完全相同。

### 4. `apps/server/src/__tests__/room.test.ts` — reaction doPass 語義（2 個新測試）
- **雙 pending seat**：seat1 pass → 窗仍開；seat2 pass → 窗關（phase ≠ "reaction"）。
- **非 pending seat 強制關窗**：放槍者 seat0 pass → ok:true，窗立即關閉（script/tests 路徑保留）。

## 未碰的禁止區
- `packages/rules/**`（win.ts/scoring.ts/wall.ts/測試斷言）、`protocol.ts`、`snapshot.ts`、`NetworkManager.gd`、門清自摸(raw=5)、八對子、自動胡：均未修改。

## 最後命令輸出

```
pnpm test
  Test Files  8 passed (8)
  Tests  161 passed (161)   ← 原 157，+4 個測試

pnpm typecheck
  packages/rules typecheck: Done
  apps/server typecheck: Done

Godot headless qa_render_check.tscn
  PASS 52 / FAIL 0   ← 原 45，+7 個斷言，exit 0
```
