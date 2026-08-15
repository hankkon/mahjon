# 過夜

- 分鐘 / 工具呼叫約略次數：約 15 分鐘 / 18 次
- 基準 win 測試：20
- 結束 pnpm test：151
- commit 列表：無（此資料夾不是 git repo，找不到 .git，故無法 commit；未擅自 git init）
- win.ts 有沒有改（是/否）：否（先前已用 mapSum 修過面子數，本輪只加測試）
- 新增不該胡案例名稱：
  - [不胡] 八對子型態但有副露（7 對手牌 + 1 碰）不可胡
  - [不胡] 4 對 + 3 順 17 張（對子過多湊不成面子）不可胡
  - [不胡] 1 槓 18 張但手牌面子不齊不可胡
  - [不胡] 字牌兩張將但數牌斷張不可胡
  - [不胡] 萬 12345689 斷張 + 筒 123 + 將 17 張不可胡
- qa-e2e.ts 有沒有改（是/否）：否（grep 無未解釋的 13/14 assert；僅莊家/連莊/dealer 行）
- NetworkManager 有沒有改（是/否）：否（先前已實作：L100 STATE_OPEN 才 is_connected=true；L116-117 ping_timeout 半開關 socket；L107-108 rejoin 在 welcome 前送出）
- 沒做完：git commit（無 repo）；階段 4-7（過夜提示詞只要求 A-F，A-E 已達）
- 人類早上看：無 commit 可用 git show；可改看 `packages/rules/src/__tests__/win.test.ts`（20 → 28 案例）與 `docs/OVERNIGHT_REPORT.md`