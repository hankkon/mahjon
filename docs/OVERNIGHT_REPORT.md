# 過夜

- 分鐘：約 135 分鐘（休息恢復後續跑）
- win.ts 有改？是/否：否（6 個指定反例在現有 detectWin 下全綠，未改最小修正；mapSum 面子數與 honor 只認刻已在先前修正）
- 6 個指定 it() 是否都在（列出）：
  - [不胡] 手牌 16 張不可胡
  - [不胡] 只有對子沒有面子不可胡
  - [不胡] 字牌東南北當順不可胡
  - [不胡] 1萬2筒3條跨花色當順不可胡
  - [不胡] 八個對子 16 張無刻不可當八對子
  - [不胡] 花牌進手不可胡
  （位於 packages/rules/src/__tests__/win.test.ts「過夜指定反例」describe，34/34 全綠）
- qa-e2e.ts 你印出的關鍵 20 行（貼進來）：
  ```
  case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      if (bot.seat === -1 && snap.you >= 0) { bot.seat = snap.you; }
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) { ... }
          if (mine.hand) bot.lastHandSize = mine.hand.length;
          if (!room.dealtChecked && bot.name === "A" && mine.hand) {
            room.dealtChecked = true;
            const expected = bot.seat === room.dealer ? 17 : 16;
            check("A", "發牌張數 閒16/莊17",
              mine.hand.length === expected,
              `seat=${bot.seat} dealer=${room.dealer} hand=${mine.hand.length} (期望 ${expected})`);
          }
        }
      }
      break;
    }
  ```
- 你補了或確認了哪段 16/17 assert：
  補上（commit 7e3757c）— room 物件新增 `dealtChecked`，首張 playing 快照時，A bot 座位 == dealer → 期望 17，否則期望 16，並 call `check("A", "發牌張數 閒16/莊17", ...)`。
- NetworkManager：貼 is_connected 那幾行：
  ```
  L38:  var is_connected := false
  L144-145: _conn_state = ConnState.CONNECTING; is_connected = false
  L96-100: (STATE_OPEN) if _conn_state == ConnState.CONNECTING:
              _conn_state = ConnState.OPEN; is_connected = true; ... _ping_timer.start(ping_interval)
  L115-117: if _ping_awaiting and _ping_sent_at > 0
              and (Time.get_ticks_msec() - _ping_sent_at) > int(ping_timeout * 1000.0):
              _handle_half_open_timeout()
  ```
  已符合 CONNECTING=false / OPEN=true / ping 逾時關 socket → 無需改（commit 08cea7d「連線狀態機核對（無需改）」）。
- pnpm test 最後 20 行：
  ```
  ✓ packages/rules/src/__tests__/win.test.ts (34 tests) 22ms
  ✓ packages/rules/src/__tests__/scoring.test.ts (41 tests) 29ms
  ✓ packages/rules/src/__tests__/kong.test.ts (11 tests) 9ms
  ✓ packages/rules/src/__tests__/wall.test.ts (21 tests) 15ms
  ✓ packages/rules/src/__tests__/chi.test.ts (9 tests) 5ms
  ✓ packages/rules/src/__tests__/peng.test.ts (8 tests) 5ms
  ✓ apps/server/src/__tests__/wss.test.ts (6 tests) 332ms
  ✓ apps/server/src/__tests__/room.test.ts (27 tests) 489ms
    ✓ Room — 斷線逾時自動託管 > reaction timeout auto-pass ... 403ms
  Test Files  8 passed (8)
  Tests  157 passed (157)
  Duration  1.02s
  ```
  typecheck：packages/rules + apps/server 皆 Done。
- git log --oneline（本晚 3 個新 commit）：
  ```
  d2740ba overnight: 指定不胡反例與 detectWin 最小修正
  7e3757c overnight: e2e 驗發牌 16/17
  08cea7d overnight: 連線狀態機核對（無需改）
  ```
- 沒做完：qa-e2e 未實際重跑（4-bot 長測貴且不穩，指示「不准重跑」）；沒做 UI / 沒拆 table.gd / 沒跑 qa-stress（指示禁止）