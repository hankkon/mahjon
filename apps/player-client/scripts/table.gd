extends Control
## Table — 牌桌視圖（Client-Safe UI）。
##
## 純渲染：所有狀態來自 GameState（伺服器快照），這裡不做任何規則判斷。
## 四家佈局：東(East) 右、南(South) 下、西(West) 左、北(North) 上。
## 視角旋轉：以「我(you)」為南方基準，把快照座位對映到四個方向。
##
## 伺服器快照揭露內容（snapshot.ts ClientSnapshot）：
##   - 自己的手牌（含 instanceId）— 點擊出牌
##   - 中央棄牌區 discards / lastDiscard（全域，非各家個別）
##   - 各家副露 melds / 手牌張數 handCount
##   - reactionHint（反應視窗選項，由伺服器計算）
##   - phaseDeadline / countdownMs（自動託管倒數）、dealer / dealerStreak（莊家連莊）、
##     players[].autoplay / connected（託管中 / 離線）、autoplayLog（本局託管紀錄）
##
## 動畫佇列（AnimationQueue）：快照之間的差異會被拆解成依序播放的動畫
##   * 摸牌飛入手牌（draw fly-in）
##   * 棄牌飛入中央棄牌池（discard fly-out）
##   * 吃碰槓牌面組合飛到副露區（meld fly）
## 播放期間鎖定玩家點擊；佇列清空後才刷入最新快照的最終畫面，
## 避免中間快照造成畫面瞬間跳變。

const TILE_BTN := preload("res://scenes/TileButton.tscn")

## 雀魂風格色票
const GOLD_TEXT := Color("#F3E5AB")
const GOLD_TEXT_DIM := Color(0.9, 0.85, 0.7, 1)
const GLASS_BG := Color("#121212CC")
const GOLD_BORDER := Color("#D4AF3766")
const IVORY_BG := Color("#FAF8F5")
const IVORY_TEXT := Color("#2B2118")
const SCORE_POS := Color("#2ECC71")
const SCORE_NEG := Color("#E74C3C")

## 座位 → 方向面板：以 you 為南方，順時針南→西→北→東。
var _seat_to_panel := {}

## 最後一次渲染的手牌（比對用，避免快照抖動重建按鈕）。
var _last_hand: Array = []

## 最後一次渲染時的中央棄牌張數（diff 用）。
var _last_discard_size := 0

## 最後一次渲染時各家副露 meld id 清單：{ seat: [meldId, ...] }。
var _last_melds: Dictionary = {}

## 本局是否已渲染過手牌（首次發牌 / 重連直接畫最終狀態，不做動畫）。
var _hand_rendered_once := false

## 動畫播放期間收到的快照，等佇列清空後要再刷一次最終畫面。
var _pending_final_render := false

## 每幀倒數的「整秒」快取 — 只在秒數變化時才寫 Label。
var _last_countdown_second := -1

## 本局結算音效是否已播放（避免 state_changed 重複觸發）。
var _settlement_sounded := false

## 目前選中的手牌 instanceId（點擊強調 + 棄牌池同張計數標記）。
var _selected_instance_id := -1

## 我出牌時點擊手牌按鈕的中心座標（供棄牌直飛動畫起始點；INF = 未設定）。
var _last_discard_origin := Vector2.INF

## 最新棄牌標記（8x8 橙黃小方塊，跟隨最後一張棄牌）。
var _last_discard_marker: ColorRect

## 倒數 ProgressBar 的「階段總長」（ms；以快照 countdownMs 為近似基準）。
var _countdown_total_ms := 1000
## 目前倒數截止（epoch ms；變更代表新階段開始）。
var _last_deadline := -1
## 倒數紅光閃爍 Tween（<5s 警示）。
var _flash_tween: Tween
## 胡按鈕金色脈動 Tween。
var _win_btn_tween: Tween

@onready var room_label: Label = %RoomLabel
@onready var status_label: Label = %StatusLabel
@onready var wall_label: Label = %WallLabel
@onready var countdown_label: Label = %CountdownLabel
@onready var dealer_info_label: Label = %DealerInfoLabel
@onready var leave_btn: Button = %LeaveBtn
@onready var lobby_panel: PanelContainer = %LobbyPanel
@onready var lobby_info: Label = %LobbyInfo
@onready var lobby_players: Label = %LobbyPlayers
@onready var ready_btn: Button = %ReadyBtn
@onready var hand_area: HBoxContainer = %HandArea
@onready var table_center: Panel = %TableCenter
@onready var hand_panel: PanelContainer = %HandPanel
@onready var hand_label: Label = %HandLabel
@onready var center_last_discard: TextureRect = %LastDiscardTile
@onready var river_bottom: GridContainer = %RiverBottom
@onready var river_top: GridContainer = %RiverTop
@onready var river_left: GridContainer = %RiverLeft
@onready var river_right: GridContainer = %RiverRight
@onready var opponent_backs: Dictionary = {
	"NorthPanel": %NorthHandBacks,
	"EastPanel": %EastHandBacks,
	"WestPanel": %WestHandBacks,
}
@onready var reaction_bar: HBoxContainer = %ReactionBar
@onready var chi_btn: Button = %ChiBtn
@onready var peng_btn: Button = %PengBtn
@onready var kong_btn: Button = %KongBtn
@onready var pass_btn: Button = %PassBtn
@onready var settlement_panel: PanelContainer = %SettlementPanel
@onready var settlement_title: Label = %SettlementTitle
@onready var settlement_detail: Label = %SettlementDetail
@onready var next_round_btn: Button = %NextRoundBtn
@onready var countdown_bar: ProgressBar = %CountdownBar
@onready var win_btn: Button = %WinBtn
@onready var settlement_backdrop: ColorRect = %SettlementBackdrop
@onready var fan_list_container: VBoxContainer = %FanListContainer
@onready var fx_layer: Control = %FXLayer

## 棄牌河池化：每個河預先建立最多 6 個 TextureRect，render 時只更新 texture 與 visible，避免 queue_free + add_child。
var _river_slots: Dictionary = {}  # GridContainer -> Array[TextureRect] (最多 24 個)

func _ready() -> void:
	var you: int = GameState.you
	var dirs := ["SouthPanel", "WestPanel", "NorthPanel", "EastPanel"]
	for i in range(4):
		var seat: int = (you + i) % 4
		_seat_to_panel[seat] = dirs[i]

	leave_btn.pressed.connect(_on_leave_pressed)
	ready_btn.pressed.connect(func(): NetworkManager.mark_ready())
	next_round_btn.pressed.connect(func(): NetworkManager.mark_ready())
	chi_btn.pressed.connect(func(): _do_reaction("chi"))
	peng_btn.pressed.connect(func(): _do_reaction("peng"))
	kong_btn.pressed.connect(func(): _do_reaction("kong"))
	pass_btn.pressed.connect(func(): NetworkManager.pass_reaction())
	win_btn.pressed.connect(_on_win_btn_pressed)
	# 動作按鈕：按壓下陷動效。
	for b: Button in [chi_btn, peng_btn, kong_btn, win_btn, pass_btn, ready_btn, next_round_btn]:
		_add_press_nudge(b)

	NetworkManager.game_started.connect(func(_dealer: int): _refresh())
	NetworkManager.game_ended.connect(func(_payload: Dictionary): _refresh())
	NetworkManager.error_received.connect(_on_error)
	GameState.state_changed.connect(_refresh)
	# 動畫佇列清空後，把最新快照的最終狀態一次刷上畫面。
	AnimationQueue.queue_drained.connect(_on_queue_drained)
	# 最新棄牌標記：8x8 橙黃小方塊（雀魂經典「最後棄牌」指示，跟隨最後一張棄牌）。
	_last_discard_marker = ColorRect.new()
	_last_discard_marker.color = Color(1.0, 0.78, 0.16, 0.95)
	_last_discard_marker.size = Vector2(8, 8)
	_last_discard_marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_last_discard_marker.z_index = 120
	_last_discard_marker.visible = false
	add_child(_last_discard_marker)
	_refresh()


## 每幀更新倒數計時與莊家資訊（依快照 phaseDeadline 本地倒數）。
func _process(_delta: float) -> void:
	if not is_inside_tree():
		return
	_update_countdown()
	_update_dealer_info()


# ---------------------------------------------------------------------------
# 渲染主流程
# ---------------------------------------------------------------------------

func _refresh() -> void:
	room_label.text = "房間：%s" % GameState.room_id
	wall_label.text = "尾牆 %d / 牌牆 %d" % [GameState.wall_head_remaining, GameState.wall_deck_remaining]
	_update_dealer_info()

	if GameState.status != "playing":
		# 離開牌局狀態時重置 diff 追蹤，下一局重新直接渲染。
		_last_hand = []
		_last_discard_size = 0
		_last_melds = {}
		_hand_rendered_once = false
		_pending_final_render = false
		_hide_all_river_slots()

	# 新的一局開始：允許下一局再次播放結算音效。
	if GameState.status == "playing":
		_settlement_sounded = false

	match GameState.status:
		"lobby":
			_render_side_panels()
			_render_lobby()
		"playing":
			_render_playing()
		"ended":
			_render_side_panels()
			_render_settlement()
	_update_top_status()


func _render_lobby() -> void:
	lobby_panel.visible = true
	settlement_panel.visible = false
	settlement_backdrop.visible = false
	reaction_bar.visible = false
	hand_panel.visible = false
	table_center.visible = false
	lobby_info.text = "房號：%s" % GameState.room_id
	var lines: Array = []
	var my_ready := false
	for p in GameState.players:
		var who: String = "（我）" if int(p.get("seat", -1)) == GameState.you else ""
		var state_txt: String = "✓ 已準備" if p.get("ready", false) else "未準備"
		lines.append("座位 %d  %s  %s%s" % [p.get("seat", -1), p.get("playerName", "?"), state_txt, who])
		if int(p.get("seat", -1)) == GameState.you and p.get("ready", false):
			my_ready = true
	lobby_players.text = "\n".join(lines)
	# 準備按鈕：已準備就鎖定並顯示確認（避免重複送出）。
	ready_btn.disabled = my_ready
	ready_btn.text = "已準備 ✓（等待開始…）" if my_ready else "準備 (Ready)"


## 牌局進行中：把「本次快照 vs 上次已渲染狀態」的差異拆解成動畫 job，
## 全部播完（queue_drained）後才把最新快照的最終畫面刷上。
func _render_playing() -> void:
	lobby_panel.visible = false
	settlement_panel.visible = false
	settlement_backdrop.visible = false
	hand_panel.visible = true
	table_center.visible = true
	_render_last_discard()

	# 動畫播放中收到新快照：不疊加新動畫，鎖定輸入，等佇列清空後一次刷入最新狀態。
	if AnimationQueue.is_playing():
		_pending_final_render = true
		reaction_bar.visible = false
		_lock_hand_input(true)
		return

	# 首次渲染（發牌 / 重連）：直接畫最終狀態，不做動畫。
	if not _hand_rendered_once:
		_render_final_state()
		return

	# 收集本次快照與上次渲染之間的差異動畫。
	var jobs: Array[Callable] = []
	_collect_anim_jobs(jobs)
	if jobs.is_empty():
		_render_final_state()
		return

	_pending_final_render = true
	_lock_hand_input(true)
	for job in jobs:
		AnimationQueue.enqueue(job)


## 動畫佇列清空：以最新 Snapshot 直接刷上最終畫面，並更新 diff 基準。
## 若期間有新快照，這會一次刷入最新狀態；若無，則完成本次動畫收尾。
## 直接走 _render_final_state() 而非 _refresh()，可避免「相同 diff
## （如手牌張數增加）在佇列清空後被 _collect_anim_jobs 重複排入」的
## 無限動畫迴圈；非 playing 狀態（lobby/ended）仍走 _refresh() 做轉場。
func _on_queue_drained() -> void:
	if not _pending_final_render:
		return
	_pending_final_render = false
	if GameState.status == "playing":
		_render_final_state()
		_update_top_status()
	else:
		_refresh()


## 把最新快照「一次刷上畫面」：四家面板、棄牌池、手牌、反應列。
func _render_final_state() -> void:
	_render_side_panels()
	_render_discard_pool()
	_update_last_discard_marker()
	_render_hand()
	_render_reaction_bar()
	_last_discard_size = GameState.discards.size()
	_last_melds = _meld_signatures()
	_hand_rendered_once = true


## 鎖定 / 解鎖手牌點擊（動畫播放期間禁止送出指令）。
func _lock_hand_input(locked: bool) -> void:
	for btn in hand_area.get_children():
		if btn is Button:
			if btn.has_method("apply_playability"):
				btn.apply_playability(not locked and GameState.is_my_discard_turn() \
					and not GameState.is_autoplay(GameState.you))
			else:
				btn.disabled = locked
				if locked:
					btn.modulate.a = 0.85


## 牌局結束：彈出結算面板（勝者 / 台數 / 四家分數增減）+「準備下一局」按鈕。
func _render_settlement() -> void:
	lobby_panel.visible = false
	reaction_bar.visible = false
	hand_panel.visible = false
	table_center.visible = false
	settlement_backdrop.visible = true
	settlement_panel.visible = true
	settlement_title.text = "本局結束"
	for c in fan_list_container.get_children():
		c.queue_free()

	# 音效 + 我胡牌特效（畫面震動 + 金色光芒擴散），只播一次。
	if not _settlement_sounded:
		_settlement_sounded = true
		var winner: int = int(GameState.settlement.get("winner", -1)) \
			if not GameState.settlement.is_empty() else -1
		if winner == GameState.you:
			AudioManager.play_win()
			_play_win_fx()
		AudioManager.play_settle()

	var header: Array = []
	header.append("莊家：%s（%s風 第 %d 局）" % [GameState.seat_name(GameState.dealer), _wind_name(GameState.dealer), GameState.dealer_streak])

	var s: Dictionary = GameState.settlement
	var line_index := 0
	if s.is_empty():
		# 流局（和局）— settlement 為 null，但仍可能因 resetForNextRound 回到 lobby。
		header.append("流局（和局）")
	else:
		var winner: int = s.get("winner", -1)
		header.append("贏家：%s" % GameState.seat_name(winner))
		if s.get("selfDraw", false):
			header.append("自摸")
		elif s.get("kongDraw", false):
			header.append("槓上開花")
		elif GameState.last_discard_by >= 0:
			header.append("放槍胡（%s 放槍）" % GameState.seat_name(GameState.last_discard_by))
		var breakdown: Dictionary = s.get("breakdown", {})
		if not breakdown.is_empty():
			var fans: Array = breakdown.get("fans", [])
			var total: int = int(breakdown.get("total", 0))
			var fan_title := Label.new()
			fan_title.text = "— 台數明細（共 %d 台）—" % total
			fan_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			_style_label(fan_title, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 16)
			_animate_settlement_line(fan_title, line_index)
			line_index += 1
			for f in fans:
				var rule: String = f.get("rule", "?")
				var val: int = int(f.get("value", 0))
				var fl := Label.new()
				fl.text = "✦ %s  +%d 台" % [rule, val]
				fl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				_style_label(fl, _make_style(Color(0.1, 0.08, 0.04, 0.8), GOLD_BORDER, 5), GOLD_TEXT, 15)
				_animate_settlement_line(fl, line_index)
				line_index += 1
		if not s.get("ledger", []).is_empty():
			var sep := Label.new()
			sep.text = "— 分數結算 —"
			sep.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			_style_label(sep, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 16)
			_animate_settlement_line(sep, line_index)
			line_index += 1
			for e in s.get("ledger", []):
				var seat: int = e.get("seat", -1)
				var delta: int = e.get("delta", 0)
				var scores: Array = s.get("scores", [])
				var total_score: int = scores[seat] if seat >= 0 and seat < scores.size() else 0
				var tag: String = "（莊）" if seat == GameState.dealer else ""
				var sign: String = "+" if delta > 0 else ""
				var cl := Label.new()
				cl.text = "%s%s：%s%d 分（累計 %d）" % [GameState.seat_name(seat), tag, sign, delta, total_score]
				cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				# 分數：正綠 + / 負紅 -。
				_style_label(cl, _make_style(GLASS_BG, GOLD_BORDER, 6), \
					SCORE_POS if delta > 0 else SCORE_NEG, 15)
				_animate_settlement_line(cl, line_index)
				line_index += 1
	if not GameState.autoplay_log.is_empty():
		var al := Label.new()
		al.text = "自動託管：%s" % GameState.autoplay_summary()
		al.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_style_label(al, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT_DIM, 14)
		_animate_settlement_line(al, line_index)

	settlement_detail.text = "\n".join(header)
	# 「準備下一局」按鈕：已準備就鎖定並顯示確認。
	var my_ready := false
	for p in GameState.players:
		if int(p.get("seat", -1)) == GameState.you and p.get("ready", false):
			my_ready = true
			break
	next_round_btn.disabled = my_ready
	next_round_btn.text = "已準備 ✓" if my_ready else "準備下一局"


func _update_top_status() -> void:
	if not GameState.is_playing():
		status_label.text = "等待中"
	elif GameState.game_phase == "reaction":
		status_label.text = "反應視窗"
	elif GameState.turn == GameState.you:
		if GameState.is_autoplay(GameState.you):
			status_label.text = "你已自動託管（伺服器代打）"
		else:
			status_label.text = "輪到你出牌"
	else:
		status_label.text = "等待 %s 出牌…" % GameState.seat_name(GameState.turn)


# ---------------------------------------------------------------------------
# 動畫 diff（比較上次「已渲染」狀態與最新快照）
# ---------------------------------------------------------------------------

## 收集本次快照 vs 上次渲染的動畫 job（依序：摸牌 → 棄牌 → 副露）。
func _collect_anim_jobs(jobs: Array[Callable]) -> void:
	var hand: Array = GameState.my_hand()
	# 1) 摸牌：手牌張數增加 → 真正摸進的那張（伺服器權威 lastDrawnTile）滑入手牌。
	if hand.size() > _last_hand.size() and _last_hand.size() > 0:
		var drawn: Variant = _resolve_newly_added_tile(hand)
		if drawn != null:
			jobs.append(_job_draw_fly_in(drawn))
	# 2) 棄牌：中央棄牌區新增 → 從棄牌者座位飛入棄牌池。
	var discards: Array = GameState.discards
	if discards.size() > _last_discard_size:
		jobs.append(_job_discard_fly_out(str(discards[discards.size() - 1])))
	# 3) 副露：各家新增 meld → 牌面組合飛到該座位副露區。
	var melds_now: Dictionary = _meld_signatures()
	for seat in range(4):
		var old: Array = _last_melds.get(seat, [])
		var now: Array = melds_now.get(seat, [])
		for i in range(old.size(), now.size()):
			# 我方槓牌：畫面震動 + 金色光芒擴散特效。
			var melds_arr: Array = _player_view(seat).get("melds", [])
			if i < melds_arr.size() and seat == GameState.you \
				and str(melds_arr[i].get("kind", "")) == "kong":
				_play_kong_fx()
			jobs.append(_job_meld_fly(seat, now[i]))


## 各家 meld id 清單（diff 用）。
func _meld_signatures() -> Dictionary:
	var out := {}
	for seat in range(4):
		var p := _player_view(seat)
		var ids: Array = []
		for m in p.get("melds", []):
			ids.append(int(m.get("id", -1)))
		out[seat] = ids
	return out


# ---------------------------------------------------------------------------
# 動畫 job（每個 job 啟動 Tween 並回傳，AnimationQueue 依序等待）
# ---------------------------------------------------------------------------

## 摸牌滑入手牌。
func _job_draw_fly_in(tile: Dictionary) -> Callable:
	var tile_id: String = str(tile.get("id", ""))
	return func() -> Tween:
		AudioManager.play_draw()
		return _fly_tile(tile_id, _wall_pos(), _hand_slot_pos())


## 棄牌直飛到目標河槽：我出牌時從點擊的手牌按鈕中心起飛，
## 對手出牌時從其座位面板中心起飛；落地時釋放飛行貼圖、顯示河槽貼圖，
## 並在落地瞬間播放棄牌音效。
func _job_discard_fly_out(tile_id: String) -> Callable:
	var seat: int = GameState.last_discard_by
	var river: GridContainer = _river_for_seat(seat) as GridContainer
	var slots: Array = _ensure_river_slots(river)
	var slot_index: int = clampi(GameState.discards_for(seat).size(), 1, 24) - 1
	var target: TextureRect = slots[slot_index]
	var slot_size: Vector2 = target.custom_minimum_size if target != null else Vector2(48, 64)
	var to_center: Vector2 = (target.global_position + slot_size / 2.0) \
		if target != null and target.global_position != Vector2.ZERO else _discard_pool_pos()
	var from_center: Vector2
	if seat == GameState.you and _last_discard_origin != Vector2.INF:
		from_center = _last_discard_origin
		_last_discard_origin = Vector2.INF
	else:
		from_center = _seat_center(seat)
	return func() -> Tween:
		return _fly_discard(tile_id, from_center, to_center, slot_size, target)


## 吃碰槓：被吃的牌面組合飛到該座位副露區。
func _job_meld_fly(seat: int, meld: Dictionary) -> Callable:
	var tid: String = str(meld.get("claimed", ""))
	if tid == "":
		var tiles: Array = meld.get("tiles", [])
		tid = str(tiles[0]) if not tiles.is_empty() else ""
	var kind: String = str(meld.get("kind", ""))
	return func() -> Tween:
		if tid == "":
			return null  # 沒有可動畫的牌面 → 同步完成。
		AudioManager.play_meld(kind)
		return _fly_tile(tid, _discard_pool_pos(), _meld_area_pos(seat), Vector2(40, 53))


## 建立一個從 from 飛到 to 的牌面貼圖動畫（播完自動釋放）。
func _fly_tile(tile_id: String, from: Vector2, to: Vector2, size: Vector2 = Vector2(48, 64)) -> Tween:
	# All tiles rendered exclusively via TileLoader.make_tile_rect() (no text labels).
	var tr := TileLoader.make_tile_rect(tile_id, size)
	tr.global_position = from
	tr.z_index = 100
	add_child(tr)
	var tw := create_tween()
	tw.tween_property(tr, "global_position", to, 0.35) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(tr, "modulate:a", 0.0, 0.18).set_delay(0.22)
	tw.tween_callback(tr.queue_free)
	return tw


## 棄牌直飛：牌面貼圖從 from_center 直飛 to_center（不淡出），落地後釋放貼圖、
## 顯示目標河槽 TextureRect，並於落地瞬間播放棄牌音效。最新棄牌標記同步跟隨。
func _fly_discard(tile_id: String, from_center: Vector2, to_center: Vector2, size: Vector2, target_slot: TextureRect) -> Tween:
	var tr := TileLoader.make_tile_rect(tile_id, size)
	tr.global_position = from_center - size / 2.0
	tr.z_index = 100
	add_child(tr)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(tr, "global_position", to_center - size / 2.0, 0.35) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	if _last_discard_marker != null:
		_last_discard_marker.visible = true
		_last_discard_marker.global_position = _marker_pos_for(from_center, size)
		tw.tween_property(_last_discard_marker, "global_position", _marker_pos_for(to_center, size), 0.35) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.set_parallel(false)
	tw.tween_callback(func():
		if is_instance_valid(tr):
			tr.queue_free()
		if target_slot != null and is_instance_valid(target_slot):
			TileLoader.apply_face(target_slot, tile_id)
			target_slot.visible = true
		AudioManager.play_discard())
	return tw


## 最新棄牌標記（8x8）置於牌面中心正上方的左上角座標。
func _marker_pos_for(tile_center: Vector2, tile_size: Vector2) -> Vector2:
	return tile_center + Vector2(-4.0, -(tile_size.y / 2.0) - 18.0)


# --- 動畫位置輔助 ---

## 摸牌來源：牌牆（TopBar 右上）。
func _wall_pos() -> Vector2:
	return wall_label.global_position + Vector2(wall_label.size.x / 2.0, 60.0)


## 手牌末端（新牌落點）：第 17 張摸牌與前 16 張融合於同一 HBoxContainer，
## 故一律飛到主手牌容器末端（最右側）。
func _hand_slot_pos() -> Vector2:
	return hand_area.global_position + Vector2(hand_area.size.x, hand_area.size.y / 2.0)


## 中央牌桌中心（棄牌 / 副露飛入落點）。
func _discard_pool_pos() -> Vector2:
	return table_center.global_position + Vector2(table_center.size.x / 2.0, table_center.size.y / 2.0)


## 該座位面板中心（棄牌來源）。
func _seat_center(seat: int) -> Vector2:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if panel_name == "":
		return _discard_pool_pos()
	var panel: Control = get_node(panel_name)
	return panel.global_position + panel.size / 2.0


## 該座位副露區落點。
func _meld_area_pos(seat: int) -> Vector2:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if panel_name == "":
		return _discard_pool_pos()
	var area: Control = get_node("%s/MeldArea" % panel_name)
	return area.global_position + Vector2(area.size.x, area.size.y / 2.0)


# ---------------------------------------------------------------------------
# 倒數計時（依快照 phaseDeadline 本地倒數）
# ---------------------------------------------------------------------------

func _update_countdown() -> void:
	if not GameState.has_countdown():
		countdown_label.text = ""
		_last_countdown_second = -1
		_last_deadline = -1
		countdown_bar.visible = false
		_countdown_bar_flash(false)
		return
	# 新階段開始：以快照 countdownMs 作為 ProgressBar 總長（近似）。
	if GameState.phase_deadline != _last_deadline:
		_last_deadline = GameState.phase_deadline
		_countdown_total_ms = maxi(GameState.countdown_ms, 1000)
	var remain_ms: int = GameState.remaining_ms()
	countdown_bar.visible = true
	countdown_bar.value = clampf(remain_ms / float(_countdown_total_ms) * 100.0, 0.0, 100.0)
	var sec: int = int(ceil(remain_ms / 1000.0))
	if sec == _last_countdown_second:
		_countdown_bar_flash(sec <= 5)
		return
	_last_countdown_second = sec
	var who: String = GameState.seat_name(GameState.turn)
	if GameState.game_phase == "reaction":
		countdown_label.text = "⏳ %d 秒" % sec
	else:
		countdown_label.text = "⏳ %s 思考 %d 秒" % [who, sec]
	# 剩 5 秒以內轉紅警示（Label + ProgressBar 紅光閃爍）。
	countdown_label.modulate = Color(0.9, 0.2, 0.2, 1) if sec <= 5 else Color(0.9, 0.55, 0.2, 1)
	_countdown_bar_flash(sec <= 5)


# ---------------------------------------------------------------------------
# 莊家與連莊資訊（TopBar）
# ---------------------------------------------------------------------------

## 以莊家為東，回傳該座位的風向名稱。
func _wind_name(seat: int) -> String:
	var winds := ["東", "南", "西", "北"]
	if GameState.dealer < 0:
		return ""
	var idx: int = (seat - GameState.dealer + 4) % 4
	return winds[idx]


func _update_dealer_info() -> void:
	if GameState.dealer < 0:
		dealer_info_label.text = "莊家：-"
		return
	var streak: int = GameState.dealer_streak
	var streak_txt: String = ""
	if streak > 0:
		streak_txt = "（連莊 %d）" % streak
	dealer_info_label.text = "%s風 莊家 %s%s" % [
		_wind_name(GameState.dealer), GameState.seat_name(GameState.dealer), streak_txt,
	]


# ---------------------------------------------------------------------------
# 四家側邊面板（玩家名 + 手牌張數 + 副露 + 莊/託管/離線標籤）
# ---------------------------------------------------------------------------

func _render_side_panels() -> void:
	for seat in range(4):
		var panel_name: String = _seat_to_panel.get(seat, "")
		if panel_name == "":
			continue
		var box: VBoxContainer = get_node(panel_name)
		# 清除舊的標題/張數標籤（保留 MeldArea / HandBacks 結構）。
		for child in box.get_children():
			if child is Label:
				child.queue_free()
		var p := _player_view(seat)
		var who: String = "（我）" if seat == GameState.you else ""
		var tag: String = _player_tag(seat, p)
		var title := Label.new()
		title.text = "%s %s (%d 張)%s%s" % [
			GameState.seat_name(seat), _wind_name(seat), p.get("handCount", 0), who, tag,
		]
		_style_label(title, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 15)
		box.add_child(title)
		box.move_child(title, 0)
		_render_melds(seat)
		# Majsoul compact opponent hand backs (back.png via TileLoader).
		if seat != GameState.you and GameState.is_playing():
			_render_hand_backs(seat)


## 建立一張「牌背」TextureRect（使用 back.png 貼圖 exclusively via TileLoader.make_back_rect() for Majsoul compact opponent hands）。
func _make_tile_back(tile_size: Vector2) -> TextureRect:
	return TileLoader.make_back_rect(tile_size)


## 對家/上家/下家：依 handCount 繪製 13-16 張牌背。
## 北（上）→ 水平置中排列，牌背 26x36；西/東（左右）→ 緊湊直列，不拉伸佔滿螢幕。
func _render_hand_backs(seat: int) -> void:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if not opponent_backs.has(panel_name):
		return
	var box: Container = opponent_backs[panel_name]
	for child in box.get_children():
		child.queue_free()
	var count: int = clampi(int(_player_view(seat).get("handCount", 0)), 13, 17)
	var horizontal: bool = box is HBoxContainer
	# 北（橫排）26x36；西/東（直列）緊湊 22x30，嚴禁拉伸成長條。
	var tile_size := Vector2(26, 36) if horizontal else Vector2(22, 30)
	# 直列（東西兩側）空間有限：最多 13 張，維持緊湊群組。
	var show: int = count if horizontal else mini(count, 13)
	for i in range(show):
		box.add_child(_make_tile_back(tile_size))


## 莊 / 託管中 / 離線 視覺標籤。
func _player_tag(seat: int, p: Dictionary) -> String:
	var tags: Array = []
	if seat == GameState.dealer:
		tags.append("[莊]")
	if p.get("autoplay", false):
		tags.append("⚠託管中")
	elif not p.get("connected", false):
		tags.append("⚡離線")
	if tags.is_empty():
		return ""
	return " " + " ".join(tags)


func _render_melds(seat: int) -> void:
	var panel_name: String = _seat_to_panel.get(seat, "")
	var box: HBoxContainer = get_node("%s/MeldArea" % panel_name)
	for child in box.get_children():
		child.queue_free()
	var p := _player_view(seat)
	for m in p.get("melds", []):
		var kind: String = str(m.get("kind", "?"))
		var kind_tag := Label.new()
		kind_tag.text = "[%s]" % kind
		_style_label(kind_tag, _make_style(GLASS_BG, GOLD_BORDER, 4), GOLD_TEXT_DIM, 12)
		box.add_child(kind_tag)
		for t in m.get("tiles", []):
			# Melds use TileLoader.make_tile_rect() exclusively (no text labels).
			box.add_child(TileLoader.make_tile_rect(str(t), Vector2(40, 53)))


# ---------------------------------------------------------------------------
# 中央棄牌區（全域）
# ---------------------------------------------------------------------------

## 座位 → 中央牌桌內側棄牌河（依 _seat_to_panel 方向對映）。
func _river_for_seat(seat: int) -> Control:
	var panel_name: String = _seat_to_panel.get(seat, "")
	match panel_name:
		"SouthPanel":
			return river_bottom
		"NorthPanel":
			return river_top
		"WestPanel":
			return river_left
		"EastPanel":
			return river_right
	return river_bottom


## 確保某個棄牌河的池化槽位已建立（最多 24 個 TextureRect = 4 行 × 6 列）。
## 第一次呼叫時建立並加入 river，之後重用；超過 24 張時只顯示最新 24 張。
func _ensure_river_slots(river: GridContainer) -> Array:
	if _river_slots.has(river):
		return _river_slots[river]
	var slots: Array = []
	# 決定此河的牌面尺寸（西/東側直列可換行空間小 → 縮小避免打爆 layout）。
	var sz := Vector2(32, 42)
	if river == river_left or river == river_right:
		sz = Vector2(16, 22)
	for i in range(24):
		var tr := TextureRect.new()
		tr.custom_minimum_size = sz
		tr.size = sz
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tr.visible = false
		river.add_child(tr)
		slots.append(tr)
	_river_slots[river] = slots
	return slots


## 離開 playing 狀態時隱藏所有河槽位（避免殘留畫面）。
func _hide_all_river_slots() -> void:
	for river in _river_slots.keys():
		for tr in _river_slots[river]:
			tr.visible = false


## 中央牌桌內側棄牌河：四家各收納在牌桌四邊內側（下/上/左/右）。
## Bottom/Top 每行 6 張（4 行 × 6 列 = 24 張）；Left/Right 垂直緊湊直列。
## 超過 24 張只顯示最新 24 張。使用池化槽位，只更新 texture 與 visible，不重建節點。
func _render_discard_pool() -> void:
	for seat in range(4):
		var river: GridContainer = _river_for_seat(seat) as GridContainer
		var slots: Array = _ensure_river_slots(river)
		var tiles: Array = GameState.discards_for(seat)
		# 超過 24 張只顯示最新 24 張（台灣一局每人最多約 20-24 張出牌）。
		if tiles.size() > 24:
			tiles = tiles.slice(tiles.size() - 24)
		for i in range(24):
			var tr: TextureRect = slots[i]
			if i < tiles.size():
				var tile_id: String = str(tiles[i])
				TileLoader.apply_face(tr, tile_id)
				tr.visible = true
			else:
				tr.visible = false


## 中央「最後棄牌」大牌面（LastDiscardTile 貼圖；無牌時隱藏）。
func _render_last_discard() -> void:
	if GameState.last_discard == "":
		center_last_discard.visible = false
		return
	center_last_discard.visible = true
	TileLoader.apply_face(center_last_discard, GameState.last_discard)


# ---------------------------------------------------------------------------
# 我的手牌（點擊出牌；動畫播放期間鎖定）
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 手牌自動理牌（Auto-Sort）
# ---------------------------------------------------------------------------

## 花色排序（萬 → 筒 → 條 → 字 → 花）。
const SUIT_RANK := {"wan": 0, "tong": 1, "tiao": 2, "honor": 3, "flower": 4}
const HONOR_RANK := {
	"dong": 1, "nan": 2, "xi": 3, "bei": 4,
	"zhong": 5, "fa": 6, "bai": 7,
}
const FLOWER_RANK := {
	"mei": 1, "lan": 2, "zhu": 3, "ju": 4,
	"chun": 5, "xia": 6, "qiu": 7, "dong": 8,
}


## 單張牌的排序鍵：花色優先，同花色由小到大。
func _tile_sort_key(t: Dictionary) -> int:
	var parts := str(t.get("id", "")).split(":")
	if parts.size() < 2:
		return 999999
	var cat: String = parts[0]
	var val: String = parts[1]
	var rank: int = int(SUIT_RANK.get(cat, 9))
	var num := 0
	if cat == "honor":
		num = int(HONOR_RANK.get(val, 0))
	elif cat == "flower":
		num = int(FLOWER_RANK.get(val, 0))
	else:
		num = val.to_int()
	return rank * 1000 + num


## 回傳「依麻將花色與順序排序後」的手牌（同張以 instanceId 穩定排序）。
func _sorted_hand(hand: Array) -> Array:
	var out: Array = hand.duplicate()
	out.sort_custom(func(a, b) -> bool:
		var ka := _tile_sort_key(a)
		var kb := _tile_sort_key(b)
		if ka != kb:
			return ka < kb
		return int(a.get("instanceId", -1)) < int(b.get("instanceId", -1)))
	return out


func _render_hand() -> void:
	var full_hand: Array = _sorted_hand(GameState.my_hand())
	hand_label.text = "我的手牌（%d 張）" % full_hand.size()
	var split := _split_drawn_tile(full_hand)
	var hand: Array = split[0]
	var drawn: Variant = split[1]
	var animating: bool = AnimationQueue.is_playing()
	var can_play: bool = GameState.is_my_discard_turn() \
		and not GameState.is_autoplay(GameState.you) and not animating
	if _hand_equals(full_hand):
		if not _order_equals(full_hand):
			# 相同牌、不同順序（自動理牌）→ 平滑重排，不重建按鈕。
			_animate_hand_reflow(hand, can_play)
		else:
			_apply_playability_all(can_play)
		_render_draw_spacer(drawn, can_play)
		_last_hand = full_hand.duplicate()
		return
	if _last_hand.is_empty():
		# 首次發牌 / 重連：直接畫最終排序狀態（無動畫，避免閃現跳動）。
		_rebuild_hand_sync(hand, can_play)
	else:
		# 摸牌 / 吃碰槓 / 棄牌：平滑合併重排（保留按鈕、滑動到位）。
		_animate_hand_reflow(hand, can_play)
	_render_draw_spacer(drawn, can_play)
	_last_hand = full_hand.duplicate()


## 以「伺服器權威 lastDrawnTile → 上一幀集合差異 → 最後一張」的優先序辨識
## 本回合真正摸進的牌（不可用 max-instanceId — 牌牆建牌先編號再洗牌，
## instanceId 與摸牌順序無關）。供摸牌分離與摸牌動畫共用，避免兩套邏輯分歧。
func _resolve_newly_added_tile(hand: Array) -> Variant:
	if hand.is_empty():
		return null
	var newest: Variant = null
	# 1) 伺服器權威：lastDrawnTile 就是本回合真正摸進的牌（GameState 註解明確：
	#    優先以它辨識第 17 張，可精確抓出「真正摸進」的那張）。
	if GameState.last_drawn_by == GameState.you and not GameState.last_drawn_tile.is_empty():
		var wanted := int(GameState.last_drawn_tile.get("instanceId", -1))
		for t in hand:
			if int(t.get("instanceId", -1)) == wanted:
				newest = t
				break
	# 2) 無伺服器權威可比（lastDrawnTile 已清空 / 非我摸牌，如吃碰後）：以「上一幀
	#    手牌」集合差異找出真正新增的 instanceId（修復摸牌跳牌）。
	if newest == null and not _last_hand.is_empty():
		var prev_ids := {}
		for t in _last_hand:
			prev_ids[int(t.get("instanceId", -1))] = true
		var candidates: Array = []
		for t in hand:
			if not prev_ids.has(int(t.get("instanceId", -1))):
				candidates.append(t)
		if candidates.size() >= 1:
			newest = candidates[0]
	# 3) 終極 fallback（正常不應發生）：退回排序後最後一張。
	if newest == null:
		newest = hand[hand.size() - 1]
	return newest


func _split_drawn_tile(hand: Array) -> Array:
	if hand.size() != 17 or not GameState.is_my_discard_turn():
		return [hand, null]
	var newest: Variant = _resolve_newly_added_tile(hand)
	var base: Array = hand.duplicate()
	base.erase(newest)
	return [base, newest]


## 摸牌分離鐵律：第 17 張摸牌「絕對禁止」建立獨立於手牌容器之外的浮動節點。
## 正確做法：在 PlayerHandContainer（hand_area）第 16 張與第 17 張之間動態插入
## 一個寬度剛好 18px 的透明 Control 間隔器，再將第 17 張牌作為該 HBox 最後一個子節點。
func _render_draw_spacer(drawn: Variant, can_play: bool) -> void:
	# 移除既有的間隔器與舊摸牌按鈕（若存在）。
	for child in hand_area.get_children():
		if child is Control and child.has_meta("draw_spacer"):
			child.queue_free()
		elif child is Button and child.has_meta("is_drawn_tile"):
			child.queue_free()
	if drawn == null:
		return
	# 建立 18px 透明間隔器，插在第 16 張（最後一張基礎牌）之後。
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(18, 0)
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.set_meta("draw_spacer", true)
	hand_area.add_child(spacer)
	# 第 17 張牌作為 HBox 最後一個子節點（與前 16 張同一容器）。
	var btn: Button = _create_tile_button(drawn, can_play)
	btn.set_meta("is_drawn_tile", true)
	hand_area.add_child(btn)


## 建立一張手牌按鈕並套用完整狀態（可出牌、選中、胡光暈、算牌高亮）。
func _create_tile_button(t: Dictionary, can_play: bool) -> Button:
	var btn: Button = TILE_BTN.instantiate()
	btn.setup(int(t.get("instanceId", -1)), str(t.get("id", "")), can_play)
	btn.disabled = not can_play
	if btn.has_method("apply_playability"):
		btn.apply_playability(can_play)
		btn.tile_clicked.connect(_on_tile_clicked)
		btn.tile_discarded.connect(_on_tile_discard_requested)
		_apply_tile_extras(btn)
	return btn


## 同步重建手牌（首發 / 重連，無動畫）。
func _rebuild_hand_sync(hand: Array, can_play: bool) -> void:
	for child in hand_area.get_children():
		child.queue_free()
	for t in hand:
		hand_area.add_child(_create_tile_button(t, can_play))


## 只更新可出牌 / 選中 / 胡光暈 / 算牌高亮（手牌內容與順序皆不變）。
## 第 17 張摸牌已融合於 hand_area 內，故單一迴圈即可涵蓋全部手牌按鈕。
func _apply_playability_all(can_play: bool) -> void:
	for child in hand_area.get_children():
		if child is Button:
			if child.has_method("apply_playability"):
				child.apply_playability(can_play)
				_apply_tile_extras(child)
			else:
				child.modulate.a = 1.0 if can_play else 0.85
				child.disabled = not can_play


## 手牌平滑重排（自動理牌動畫）：
##   * 仍存在的手牌 → 平滑滑動到排序後的新位置（HBox 重排後 Tween）
##   * 被移除的牌 → 淡出後移除
##   * 新加入的牌 → 淡入
## 純視覺動畫（不進 AnimationQueue，不影響出牌輸入鎖定）。
func _animate_hand_reflow(hand: Array, can_play: bool) -> void:
	var from_pos := {}
	var old_buttons := {}
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child:
			from_pos[child.instance_id] = child.global_position
			old_buttons[child.instance_id] = child
	# 1) 已不存在的手牌 → 淡出移除。
	#    第 17 張摸牌（meta is_drawn_tile）已融合於 hand_area，視為常駐，不得移除。
	var keep_ids := {}
	for t in hand:
		keep_ids[int(t.get("instanceId", -1))] = true
	for child in hand_area.get_children():
		if child is Button and child.has_meta("is_drawn_tile"):
			keep_ids[int(child.instance_id)] = true
	for inst in old_buttons:
		if not keep_ids.has(inst):
			var btn: Button = old_buttons[inst]
			var tw := create_tween()
			tw.tween_property(btn, "modulate:a", 0.0, 0.15)
			tw.tween_callback(btn.queue_free)
	# 2) 依排序順序重新排列既有按鈕（move_child → HBox 自動重排）。
	#    只重排前 16 張基礎牌；間隔器與第 17 張摸牌保持在容器末端。
	for i in range(hand.size()):
		var inst := int(hand[i].get("instanceId", -1))
		var btn = old_buttons.get(inst)
		if btn != null and hand_area.get_children().find(btn) != i:
			hand_area.move_child(btn, i)
	# 3) 新增的手牌 → 建立按鈕 + 淡入。
	for i in range(hand.size()):
		var inst := int(hand[i].get("instanceId", -1))
		if old_buttons.has(inst):
			continue
		var btn: Button = _create_tile_button(hand[i], can_play)
		hand_area.add_child(btn)
		hand_area.move_child(btn, i)
		btn.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(btn, "modulate:a", 1.0, 0.25)
	# 4) 同步套用可出牌狀態（解除動畫鎖定）；重排期間暫停上浮，避免 Tween 衝突。
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child:
			if child.has_method("set_suppress_lift"):
				child.set_suppress_lift(true)
			if child.has_method("apply_playability"):
				child.apply_playability(can_play)
	# 5) 等一幀讓 HBox 套用新排序位置，再平滑滑動舊位置 → 新位置。
	await get_tree().process_frame
	var last_tw: Tween = null
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and keep_ids.has(child.instance_id):
			var new_gp: Vector2 = child.global_position
			var old: Variant = from_pos.get(child.instance_id)
			if old != null and old != new_gp:
				child.global_position = old
				var tw := create_tween()
				tw.tween_property(child, "global_position", new_gp, 0.22) \
					.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
				last_tw = tw
	if last_tw:
		await last_tw.finished
	# 6) 動畫結束：更新基準位置，恢復上浮，並套用選中 / 胡光暈 / 算牌高亮。
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and keep_ids.has(child.instance_id):
			if child.has_method("reset_base_position"):
				child.reset_base_position()
			if child.has_method("set_suppress_lift"):
				child.set_suppress_lift(false)
			if child.has_method("apply_playability"):
				_apply_tile_extras(child)


## 依目前快照套用：胡牌光暈（canWin）與選中框。
## 算牌張數（棄牌池同張剩餘）不再以整手「淡金底」標記 — 棄牌池隨對局累積後會讓
## 滿手牌出現黃色框框（視覺噪音），改為僅在「點選中的牌」以 tooltip 顯示張數。
func _apply_tile_extras(btn: Button) -> void:
	if not btn.has_method("set_win_glow") or not btn.has_method("set_selected"):
		return
	btn.set_win_glow(GameState.can_win)
	var inst: int = btn.instance_id if "instance_id" in btn else -1
	btn.set_selected(inst == _selected_instance_id)
	# 輪到「我」出牌時，點選的牌顯示棄牌池中同張剩餘張數（tooltip）。
	if inst == _selected_instance_id and GameState.is_my_discard_turn() and btn.tile_id != "":
		var out: int = 0
		for d in GameState.discards:
			if str(d) == btn.tile_id:
				out += 1
		btn.tooltip_text = "%s 棄牌池已出 %d 張" % [GameState.tile_label(btn.tile_id), out]
	else:
		btn.tooltip_text = btn.tile_id


## 更新選中 instanceId，並同步所有手牌按鈕的選中/算牌高亮與棄牌池同款高亮。
func _set_selection(instance_id: int) -> void:
	_selected_instance_id = instance_id
	for child in hand_area.get_children():
		if child is Button and child.has_method("set_selected"):
			_apply_tile_extras(child)
	_highlight_discard_matches()


## 第一次點擊手牌：選中（抬升 + 金色外框 + 同款高亮）。
func _on_tile_clicked(instance_id: int) -> void:
	_set_selection(instance_id)


## 第二次點擊（已選中）送出出牌前：記錄點擊按鈕中心座標（供棄牌直飛動畫起點），
## 並清除選中狀態。
func _on_tile_discard_requested(instance_id: int) -> void:
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and int(child.instance_id) == instance_id:
			_last_discard_origin = child.global_position + child.size / 2.0
			break
	_set_selection(-1)


## 棄牌池同款高亮：把與選中牌同款的河槽貼圖暖金染色（其餘回復原色）。
func _highlight_discard_matches() -> void:
	var selected_tile_id := ""
	if _selected_instance_id >= 0:
		for child in hand_area.get_children():
			if child is Button and "instance_id" in child \
				and int(child.instance_id) == _selected_instance_id:
				selected_tile_id = str(child.tile_id)
				break
	for river in _river_slots.keys():
		for tr in _river_slots[river]:
			if selected_tile_id != "" and tr.visible \
				and str(tr.get_meta("tile_id", "")) == selected_tile_id:
				tr.modulate = Color(1.3, 1.15, 0.7, 1.0)
			else:
				tr.modulate = Color(1.0, 1.0, 1.0, 1.0)


## 最新棄牌標記：定位到最後一張棄牌的河槽正上方（跟隨最後棄牌）。
func _update_last_discard_marker() -> void:
	if _last_discard_marker == null:
		return
	if GameState.last_discard == "" or GameState.last_discard_by < 0:
		_last_discard_marker.visible = false
		return
	var seat: int = GameState.last_discard_by
	var river: GridContainer = _river_for_seat(seat) as GridContainer
	var slots: Array = _ensure_river_slots(river)
	var slot_index: int = clampi(GameState.discards_for(seat).size(), 1, 24) - 1
	var target: TextureRect = slots[slot_index]
	if target == null or target.global_position == Vector2.ZERO:
		_last_discard_marker.visible = false
		return
	var slot_size: Vector2 = target.custom_minimum_size
	_last_discard_marker.global_position = _marker_pos_for(
		target.global_position + slot_size / 2.0, slot_size)
	_last_discard_marker.visible = true


## 手牌內容是否相同（以 instanceId 集合比對，順序無關 — 排序屬客戶端美化）。
func _hand_equals(hand: Array) -> bool:
	if hand.size() != _last_hand.size():
		return false
	var set_a := {}
	for t in hand:
		set_a[int(t.get("instanceId", -1))] = true
	for t in _last_hand:
		if not set_a.has(int(t.get("instanceId", -1))):
			return false
	return true


## 手牌順序是否完全相同（依序比對 instanceId）。
func _order_equals(hand: Array) -> bool:
	if hand.size() != _last_hand.size():
		return false
	for i in range(hand.size()):
		if int(hand[i].get("instanceId", -1)) != int(_last_hand[i].get("instanceId", -1)):
			return false
	return true


# ---------------------------------------------------------------------------
# 反應視窗（伺服器計算，客戶端只顯示；動畫播放期間隱藏）
# ---------------------------------------------------------------------------

func _render_reaction_bar() -> void:
	if not GameState.in_reaction_window() or AnimationQueue.is_playing():
		reaction_bar.visible = false
		win_btn.visible = false
		_stop_win_btn_pulse()
		return
	reaction_bar.visible = true
	chi_btn.disabled = not _can_react("chi")
	peng_btn.disabled = not _can_react("peng")
	kong_btn.disabled = not _can_react("kong")
	_update_win_btn()


func _can_react(kind: String) -> bool:
	for o in GameState.reaction_options():
		if o.get("kind", "") == kind:
			return true
	return false


func _do_reaction(kind: String) -> void:
	for o in GameState.reaction_options():
		if o.get("kind", "") != kind:
			continue
		var hand_tile_ids: Array = o.get("handTileIds", [])
		var extra: Dictionary = {}
		if o.has("kongType"):
			extra["kongType"] = o.get("kongType", "open")
		if o.has("pengMeldId") and int(o.get("pengMeldId", 0)) > 0:
			extra["pengMeldId"] = o.get("pengMeldId", 0)
		NetworkManager.react(kind, hand_tile_ids, extra)
		return
	push_warning("Table: 目前沒有 %s 的合法反應" % kind)


# ---------------------------------------------------------------------------
# 其他
# ---------------------------------------------------------------------------

func _player_view(seat: int) -> Dictionary:
	for p in GameState.players:
		if int(p.get("seat", -1)) == seat:
			return p
	return {}


func _on_error(code: String, message: String, _operation_id: String) -> void:
	status_label.text = "錯誤 [%s] %s" % [code, message]


func _on_leave_pressed() -> void:
	NetworkManager.disconnect_from_server()
	get_tree().change_scene_to_file("res://scenes/Main.tscn")


# ---------------------------------------------------------------------------
# 雀魂風格：樣式工廠 + 特效
# ---------------------------------------------------------------------------

## 建立玻璃/牌面 StyleBoxFlat（圓角 + 金邊 + 底部陰影）。
func _make_style(bg: Color, border: Color, radius: int = 6, border_w: int = 1) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.border_width_left = border_w
	sb.border_width_right = border_w
	sb.border_width_top = border_w
	sb.border_width_bottom = border_w
	sb.corner_radius_top_left = radius
	sb.corner_radius_top_right = radius
	sb.corner_radius_bottom_left = radius
	sb.corner_radius_bottom_right = radius
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 3
	sb.shadow_offset = Vector2(0, 2)
	return sb


## 套用樣式到 Label（背景 StyleBox + 文字色 + 字號）。
func _style_label(lbl: Label, sb: StyleBoxFlat, color: Color, font_size: int = -1) -> void:
	lbl.add_theme_stylebox_override("normal", sb)
	lbl.add_theme_color_override("font_color", color)
	if font_size > 0:
		lbl.add_theme_font_size_override("font_size", font_size)


## 倒數 ProgressBar：剩 5 秒以內啟動紅光閃爍 Tween。
func _countdown_bar_flash(urgent: bool) -> void:
	if urgent and (_flash_tween == null or not _flash_tween.is_valid()):
		_flash_tween = create_tween().set_loops()
		_flash_tween.tween_property(countdown_bar, "modulate", Color(1.6, 0.3, 0.3, 1), 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_flash_tween.tween_property(countdown_bar, "modulate", Color(1.0, 1.0, 1.0, 1), 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	elif not urgent and _flash_tween and _flash_tween.is_valid():
		_flash_tween.kill()
		_flash_tween = null
		countdown_bar.modulate = Color(1.0, 1.0, 1.0, 1)


## 動作按鈕按壓下陷動效（position.y += 2）。
func _add_press_nudge(btn: Button) -> void:
	btn.button_down.connect(func(): btn.position += Vector2(0, 2))
	btn.button_up.connect(func(): btn.position -= Vector2(0, 2))


## 胡按鈕：spec 定義「合法即自動胡（auto-win）、沒有胡/過按鈕」，
## 伺服器在 detectWin 成立時自動 finishWin。此按鈕保留節點（不刪以免場景壞掉），
## 但永遠隱藏，不提供玩家「胡」選項。`canWin`（聽牌）仍驅動手牌光暈。
func _update_win_btn() -> void:
	# auto-win：不顯示胡按鈕；保留 _on_win_btn_pressed 特效防呆（不送指令）。
	win_btn.visible = false
	_stop_win_btn_pulse()
	win_btn.text = "可胡！"


func _stop_win_btn_pulse() -> void:
	if _win_btn_tween and _win_btn_tween.is_valid():
		_win_btn_tween.kill()
		_win_btn_tween = null
	win_btn.modulate = Color(1.0, 1.0, 1.0, 1)


func _on_win_btn_pressed() -> void:
	AudioManager.play_button()
	# 伺服器為自動胡牌（canWin 驅動），這裡只做回饋特效。
	_play_screen_shake()
	_play_gold_burst("可胡！")


## 我胡牌：畫面震動 + 金色光芒擴散。
func _play_win_fx() -> void:
	_play_screen_shake()
	var s: Dictionary = GameState.settlement
	var label := "胡！"
	if s.get("selfDraw", false):
		label = "自摸！"
	elif s.get("kongDraw", false):
		label = "槓上開花！"
	_play_gold_burst(label)


## 我方槓牌：畫面震動 + 金色光芒擴散。
func _play_kong_fx() -> void:
	_play_screen_shake()
	_play_gold_burst("槓！")


## 畫面震動：5 個隨機位移幀後回歸原位。
func _play_screen_shake() -> void:
	var tw := create_tween()
	var orig := Vector2.ZERO
	for i in range(5):
		var off := Vector2(randf_range(-9.0, 9.0), randf_range(-9.0, 9.0))
		tw.tween_property(self, "position", orig + off, 0.035)
	tw.tween_property(self, "position", orig, 0.035)


## 中央金色光芒擴散 + 大字（FXLayer 中心）。
func _play_gold_burst(label_text: String) -> void:
	if not is_inside_tree() or fx_layer == null:
		return
	var center: Vector2 = fx_layer.size / 2.0
	# 金色放射光芒（Radial Gradient 放大淡出）。
	var grad := Gradient.new()
	grad.set_color(0, Color(1.0, 0.86, 0.35, 0.95))
	grad.set_color(1, Color(1.0, 0.86, 0.35, 0.0))
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.width = 256
	tex.height = 256
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1, 1)
	tex.fill = GradientTexture2D.FILL_RADIAL
	var glow := TextureRect.new()
	glow.texture = tex
	glow.size = Vector2(220, 220)
	glow.pivot_offset = Vector2(110, 110)
	glow.position = center - Vector2(110, 110)
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx_layer.add_child(glow)
	var tw := create_tween()
	tw.tween_property(glow, "scale", Vector2(3.2, 3.2), 0.55) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(glow, "modulate:a", 0.0, 0.55)
	tw.tween_callback(glow.queue_free)
	# 中央大字。
	var lbl := Label.new()
	lbl.text = label_text
	lbl.add_theme_font_size_override("font_size", 52)
	lbl.add_theme_color_override("font_color", GOLD_TEXT)
	lbl.add_theme_color_override("font_outline_color", Color(0.55, 0.35, 0.05, 1))
	lbl.add_theme_constant_override("outline_size", 10)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.size = Vector2(420, 64)
	lbl.pivot_offset = Vector2(210, 32)
	lbl.position = center - Vector2(210, 32)
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx_layer.add_child(lbl)
	var tw2 := create_tween()
	tw2.tween_property(lbl, "scale", Vector2(1.35, 1.35), 0.35) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw2.parallel().tween_property(lbl, "modulate:a", 0.0, 0.5).set_delay(0.45)
	tw2.tween_callback(lbl.queue_free)


## 結算面板逐項淡入上滑（加入 FanListContainer 後動畫）。
func _animate_settlement_line(lbl: Label, index: int) -> void:
	fan_list_container.add_child(lbl)
	lbl.modulate.a = 0.0
	await get_tree().process_frame
	if not is_instance_valid(lbl) or lbl.get_parent() != fan_list_container:
		return
	var base: Vector2 = lbl.position
	lbl.position = base + Vector2(0, 14)
	var tw := create_tween()
	tw.tween_interval(0.06 * index)
	tw.tween_property(lbl, "position", base, 0.32) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(lbl, "modulate:a", 1.0, 0.32)
