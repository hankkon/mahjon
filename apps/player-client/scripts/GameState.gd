extends Node
## GameState — Client-Safe 全域狀態 (Autoload 單例)
##
## 只存放伺服器快照揭露的「可觀察狀態」，並提供 UI 需要的輔助函式。
## 嚴禁在此實作任何吃碰槓胡判斷邏輯 — 判斷完全由伺服器負責。

signal state_changed

# --- 目前快照（對應 server snapshot.ts ClientSnapshot） ---
var status := "lobby"          # "lobby" | "playing" | "ended"
var generation_id := 0
var you := 0
var dealer := -1
## 連莊數（0 = 新任莊家；>=1 = 連續連莊）。
var dealer_streak := 0
var turn := -1
var game_phase := ""
var room_id := ""
var players: Array = []        # [ {seat, playerId, playerName, connected, ready, autoplay, handCount, hand, flowers, melds} ]
var discards: Array = []       # [tileId, ...] 中央棄牌區（歷史）
## 各家棄牌河：[[seat0 棄牌...], [seat1 棄牌...], [seat2 棄牌...], [seat3 棄牌...]]
var discards_by_seat: Array = [[], [], [], []]
var last_discard := ""
var last_discard_by := -1
## 最近一次摸牌者座位（公開可觀測 — 由回合流程得知）。
var last_drawn_by := -1
## 最近一次摸到的牌（僅自己可視）：{instanceId, id} 或 {}。
## 供第 17 張摸牌分離使用 — 伺服器權威辨識（不可用 max-instanceId）。
var last_drawn_tile: Dictionary = {}
var wall_head_remaining := 0
var wall_deck_remaining := 0
var reaction_hint: Dictionary = {}   # {canChi, canPeng, canKong, chiOptions, kongOptions}
## 可胡狀態（聽牌）— 伺服器快照判定還差一張即可胡牌（胡牌光暈用）。
var can_win := false
var winner := -1
var settlement: Dictionary = {}      # {winner, selfDraw, kongDraw, breakdown, ledger, scores}
## 目前階段的自動託管截止時間（epoch ms；null = 無倒數）。
var phase_deadline := -1
## 從快照計算出的剩餘毫秒（供倒數顯示；null = 無倒數）。
var countdown_ms := -1
## 本局伺服器自動託管紀錄：[ {seat, action, reason, at} ]。
var autoplay_log: Array = []
## 打牌與聽牌提示 (Discard & Tenpai Hints)：[ {tileInstanceId, tileId, isTenpai, shanten, waits, totalWaitRemaining} ]
var discard_hints: Array = []
## 可證明公平性承諾與開牌證明 (Provably Fair)
var provably_fair: Dictionary = {}
## 歷史牌譜覆盤紀錄 (Match Replay)
var match_replay: Dictionary = {}
## 四家即時分數/代幣點數 [seat0, seat1, seat2, seat3]
var scores: Array = [0, 0, 0, 0]

# --- 標籤文字對照 ---
const SUIT_CN := {"wan": "萬", "tiao": "條", "tong": "筒"}
const HONOR_CN := {
	"dong": "東", "nan": "南", "xi": "西", "bei": "北",
	"zhong": "中", "fa": "發", "bai": "白",
}
const FLOWER_CN := {
	"mei": "梅", "lan": "蘭", "zhu": "竹", "ju": "菊",
	"chun": "春", "xia": "夏", "qiu": "秋", "dong": "冬",
}


# ---------------------------------------------------------------------------
# 快照套用（唯一寫入點 — 由 NetworkManager 呼叫）
# ---------------------------------------------------------------------------

func apply_snapshot(snap: Dictionary) -> void:
	status = snap.get("status", status)
	generation_id = snap.get("generationId", generation_id)
	you = snap.get("you", you)
	dealer = snap.get("dealer", -1) if snap.get("dealer") != null else -1
	dealer_streak = snap.get("dealerStreak", 0) if snap.get("dealerStreak") != null else 0
	turn = snap.get("turn", -1) if snap.get("turn") != null else -1
	game_phase = snap.get("gamePhase", "") if snap.get("gamePhase") != null else ""
	room_id = snap.get("roomId", room_id)
	players = snap.get("players", [])
	discards = snap.get("discards", [])
	discards_by_seat = snap.get("discardsBySeat", [[], [], [], []])
	last_discard = snap.get("lastDiscard", "") if snap.get("lastDiscard") != null else ""
	last_discard_by = snap.get("lastDiscardBy", -1) if snap.get("lastDiscardBy") != null else -1
	last_drawn_by = snap.get("lastDrawnBy", -1) if snap.get("lastDrawnBy") != null else -1
	last_drawn_tile = snap.get("lastDrawnTile", {}) if snap.get("lastDrawnTile") != null else {}
	var wall: Dictionary = snap.get("wall", {})
	wall_head_remaining = wall.get("headRemaining", 0)
	wall_deck_remaining = wall.get("deckRemaining", 0)
	reaction_hint = snap.get("reactionHint", {}) if snap.get("reactionHint") != null else {}
	discard_hints = snap.get("discardHints", []) if snap.get("discardHints") != null else []
	provably_fair = snap.get("provablyFair", {}) if snap.get("provablyFair") != null else {}
	match_replay = snap.get("matchReplay", {}) if snap.get("matchReplay") != null else {}
	scores = snap.get("scores", scores) if snap.get("scores") != null else scores
	can_win = snap.get("canWin", false) == true
	winner = snap.get("winner", -1) if snap.get("winner") != null else -1
	settlement = snap.get("settlement", {}) if snap.get("settlement") != null else {}
	phase_deadline = snap.get("phaseDeadline", -1) if snap.get("phaseDeadline") != null else -1
	countdown_ms = snap.get("countdownMs", -1) if snap.get("countdownMs") != null else -1
	autoplay_log = snap.get("autoplayLog", []) if snap.get("autoplayLog") != null else []
	state_changed.emit()


# ---------------------------------------------------------------------------
# 查詢輔助
# ---------------------------------------------------------------------------

func is_playing() -> bool:
	return status == "playing"


## 我的 PlayerView。
func my_player() -> Dictionary:
	for p in players:
		if int(p.get("seat", -1)) == you:
			return p
	return {}


## 我的手牌：[ {instanceId, id}, ... ]（伺服器只揭露自己的手牌）。
func my_hand() -> Array:
	var me := my_player()
	return me.get("hand", []) if me.get("hand") != null else []


## 是否輪到我出牌（discard phase 且 turn == you）。
func is_my_discard_turn() -> bool:
	return is_playing() and game_phase == "discard" and turn == you


## 反應視窗是否開啟且包含我（reaction phase）。
func in_reaction_window() -> bool:
	return is_playing() and game_phase == "reaction" and not reaction_hint.is_empty()


## 反應視窗的選項清單：[ {kind, handTileIds, kongType, pengMeldId, run} ]
func reaction_options() -> Array:
	if not in_reaction_window():
		return []
	var opts: Array = []
	if reaction_hint.get("canChi", false):
		for o in reaction_hint.get("chiOptions", []):
			opts.append({"kind": "chi", "handTileIds": o.get("handTileIds", []), "run": o.get("run", [])})
	if reaction_hint.get("canPeng", false):
		opts.append({"kind": "peng", "handTileIds": []})
	if reaction_hint.get("canKong", false):
		for o in reaction_hint.get("kongOptions", []):
			opts.append({
				"kind": "kong",
				"kongType": o.get("kongType", "open"),
				"handTileIds": o.get("handTileIds", []),
				"pengMeldId": o.get("pengMeldId", 0),
			})
	return opts


# ---------------------------------------------------------------------------
# 顯示輔助（TileId → 中文標籤）
# ---------------------------------------------------------------------------

## 把 "wan:5" 這種 TileId 轉成顯示字串，例如 "5萬"、"東"、"梅"。
func tile_label(tile_id: String) -> String:
	var parts := tile_id.split(":")
	if parts.size() < 2:
		return tile_id
	var category := parts[0]
	var value := parts[1]
	match category:
		"wan", "tiao", "tong":
			return "%s%s" % [value, SUIT_CN.get(category, category)]
		"honor":
			return HONOR_CN.get(value, value)
		"flower":
			return FLOWER_CN.get(value, value)
		_:
			return tile_id


## 把 meld.tiles（TileId 陣列）轉成標籤字串。
func meld_label(meld: Dictionary) -> String:
	var labels: Array = []
	for t in meld.get("tiles", []):
		labels.append(tile_label(t))
	return " ".join(labels)


func seat_name(seat: int) -> String:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("playerName", "?")
	return "?"


func player_hand_count(seat: int) -> int:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return int(p.get("handCount", 0))
	return 0


## 該座位的棄牌河：[tileId, ...]（依棄牌順序）。
func discards_for(seat: int) -> Array:
	if seat < 0 or seat >= discards_by_seat.size():
		return []
	return discards_by_seat[seat]


# ---------------------------------------------------------------------------
# 自動託管 / 倒數計時輔助（對應 snapshot phaseDeadline / countdownMs）
# ---------------------------------------------------------------------------

## 是否還有階段倒數（discard 摸切 / reaction 自動 pass）。
func has_countdown() -> bool:
	return is_playing() and phase_deadline > 0


## 目前距離截止的剩餘毫秒（即時計算，會隨時間遞減）。
func remaining_ms() -> int:
	if not has_countdown():
		return -1
	var remain: int = phase_deadline - Time.get_unix_time_from_system() * 1000.0
	return int(maxf(0.0, remain))


## 該座位是否正在自動託管（伺服器代打）。
func is_autoplay(seat: int) -> bool:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("autoplay", false) == true
	return false


## 該座位是否離線（斷線中）。
func is_offline(seat: int) -> bool:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("connected", false) == false
	return false


## 本局自動託管摘要文字（例如「B摸切、C過」）。
func autoplay_summary() -> String:
	if autoplay_log.is_empty():
		return "無"
	var parts: Array = []
	for e in autoplay_log:
		var seat: int = int(e.get("seat", -1))
		var action: String = "摸切" if e.get("action", "") == "discard" else "過"
		parts.append("%s%s" % [seat_name(seat), action])
	return "、".join(parts)


## 取得特定手牌打出後的聽牌/進張提示
func get_discard_hint(instance_id: int) -> Dictionary:
	for h in discard_hints:
		if int(h.get("tileInstanceId", -1)) == instance_id:
			return h
	return {}

