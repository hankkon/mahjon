// 監控腳本：訂閱伺服器事件，輸出對局流程摘要（不干擾實際連線）
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:3000/ws");
ws.on("open", () => console.log("[monitor] 監控連線已建立"));
ws.on("message", (raw) => {
  const e = JSON.parse(raw.toString());
  if (["room.created", "player.joined", "player.ready", "game.started", "game.ended", "error"].includes(e.type)) {
    console.log(`[monitor] ${e.type}`, JSON.stringify(e).slice(0, 200));
  }
  if (e.type === "snapshot") {
    const s = e.snapshot;
    console.log(`[monitor] snapshot status=${s.status} turn=${s.turn} phase=${s.gamePhase} discards=${s.discards.length} players=${s.players.map(p=>p.ready?"R":"-").join("")}`);
  }
});
ws.on("close", () => { console.log("[monitor] 連線關閉"); process.exit(0); });
ws.on("error", (err) => { console.log("[monitor] 錯誤:", err.message); process.exit(1); });
