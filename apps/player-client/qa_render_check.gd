extends Node
## qa_render_check.gd — Godot 客戶端渲染驗證（情境 B/C/D UI 層）。
##
## 以 headless 模式載入真實的 Table.tscn，透過 GameState.apply_snapshot()
## 注入伺服器形狀的快照，驗證：
##
##   情境 B【動畫佇列與輸入鎖定】
##     * 快照 diff（摸牌）會產生動畫 job
##     * 動畫播放期間手牌按鈕被鎖定（disabled）、反應列隱藏
##     * 動畫佇列清空後（queue_drained）最終畫面正確刷入
##
##   情境 C【逾時託管 UI】
##     * phaseDeadline ≤5s 時倒數文字轉紅
##     * players[].autoplay → 側邊面板顯示 ⚠託管中
##
##   情境 D【結算面板】
##     * 連莊加成台（莊家連莊台）出現在台數明細
##     * 四家 ledger delta 顯示 + 累計分
##
##   情境 E【手牌自動理牌（Auto-Sort）】
##     * 萬筒條字花花色排序、相同牌以 instanceId 穩定排序
##
##   情境 F【對手牌背與中央棄牌河（貼圖版）】
##     * 對家（北）橫排、東西兩側直列的牌背（13-16 張，皆用 back.png 貼圖）
##     * 四家棄牌河收納在中央牌桌四邊內緣（Bottom/Top/Left/Right），純牌面 TextureRect 貼圖
##     * 情境 E 另驗證手牌按鈕無純文字、Face 節點皆有貼圖
##
## 使用（先跑在專案內，autoload 才會載入）:
##   /path/to/Godot --headless --path apps/player-client res://qa_render_check.tscn
## Exit code 0 = 全 PASS；1 = 任一 FAIL。

const TableScene := preload("res://scenes/Table.tscn")

var _pass := 0
var _fail := 0
var _table: Node
var _checks: Array = []

func _check(name: String, ok: bool, detail: String = "") -> void:
	_checks.append([name, ok, detail])
	if ok:
		_pass += 1
		print("[qa][client] ✅ PASS %s%s" % [name, (" — " + detail) if detail != "" else ""])
	else:
		_fail += 1
		print("[qa][client] ❌ FAIL %s%s" % [name, (" — " + detail) if detail != "" else ""])


# ---------------------------------------------------------------------------
# 快照工廠（與 apps/server snapshot.ts ClientSnapshot 相同形狀）
# ---------------------------------------------------------------------------

func _player(seat: int, name: String, hand_count: int, autoplay: bool, melds: Array = [], hand: Array = []) -> Dictionary:
	return {
		"seat": seat, "playerId": "id-%s" % seat, "playerName": name,
		"connected": true, "ready": true, "autoplay": autoplay,
		"handCount": hand_count, "hand": hand, "melds": melds,
	}

func _hand(size: int) -> Array:
	var out: Array = []
	for i in range(size):
		out.append({"instanceId": i + 1, "id": "wan:%d" % ((i % 9) + 1)})
	return out

func _playing_snap(you: int, extra: Dictionary = {}, hand_size: int = 0) -> Dictionary:
	var players: Array = [
		_player(0, "A", 15, false, [], _hand(hand_size) if you == 0 and hand_size > 0 else []),
		_player(1, "B", 15, false),
		_player(2, "C", 15, false),
		_player(3, "D", 15, false),
	]
	var snap: Dictionary = {
		"status": "playing", "generationId": 1, "you": you, "dealer": 0,
		"dealerStreak": 3, "turn": you, "gamePhase": "discard",
		"roomId": "roomX", "players": players,
		"discards": [], "discardsBySeat": [[], [], [], []],
		"lastDiscard": "", "lastDiscardBy": -1,
		"lastDrawnBy": -1, "lastDrawnTile": null,
		"wall": {"headRemaining": 60, "deckRemaining": 8},
		"reactionHint": null, "phaseDeadline": null, "countdownMs": null,
		"autoplayLog": [], "winner": null, "settlement": null,
	}
	for k in extra:
		snap[k] = extra[k]
	return snap

func _ended_snap(extra: Dictionary = {}) -> Dictionary:
	var snap: Dictionary = {
		"status": "ended", "generationId": 9, "you": 0, "dealer": 0,
		"dealerStreak": 3, "turn": -1, "gamePhase": null,
		"roomId": "roomX", "players": [
			_player(0, "A", 0, false),
			_player(1, "B", 0, false),
			_player(2, "C", 0, false),
			_player(3, "D", 0, false),
		],
		"discards": [], "discardsBySeat": [[], [], [], []],
		"lastDiscard": "", "lastDiscardBy": -1,
		"lastDrawnBy": -1, "lastDrawnTile": null,
		"wall": {"headRemaining": 0, "deckRemaining": 0},
		"reactionHint": null, "phaseDeadline": null, "countdownMs": null,
		"autoplayLog": [], "winner": 0, "settlement": null,
	}
	for k in extra:
		snap[k] = extra[k]
	return snap


# ---------------------------------------------------------------------------
# 各情境驗證
# ---------------------------------------------------------------------------

func _scenario_b() -> void:
	print("\n================= 情境 B：動畫佇列與輸入鎖定 =================")
	var you := 0
	# 初始發牌：15 張手牌 → 直接渲染（無動畫）。
	GameState.apply_snapshot(_playing_snap(you, {}, 15))
	await get_tree().process_frame
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var btn_count: int = hand_area.get_children().size()
	_check("B：發牌後手牌按鈕已建立", btn_count == 15, "按鈕 %d 顆" % btn_count)

	# 注入「摸牌」快照（手牌 16 張）→ 應觸發 draw fly-in 動畫。
	var draw_snap: Dictionary = _playing_snap(you, {"generationId": 2}, 16)
	GameState.apply_snapshot(draw_snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var animating: bool = AnimationQueue.is_playing()
	_check("B：摸牌快照觸發動畫佇列播放", animating)

	var locked := true
	for child in hand_area.get_children():
		if child is Button and not child.disabled:
			locked = false
	_check("B：動畫播放期間手牌輸入鎖定", locked)

	_check("B：動畫播放期間反應列隱藏", not _table.get_node("%ReactionBar").visible)

	# 等動畫佇列清空（每個 job ~0.35s）。
	var drained := false
	var wait := 0
	while not drained and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			drained = true
	_check("B：動畫佇列清空後恢復", drained, "等待 %d 幀" % wait)

	var unlocked := false
	for child in hand_area.get_children():
		if child is Button and not child.disabled:
			unlocked = true
	_check("B：動畫結束後手牌輸入解鎖", unlocked)


func _scenario_c() -> void:
	print("\n================= 情境 C：逾時與託管 UI =================")
	var you := 0
	# 模擬 B 被自動託管 + 倒數只剩 4 秒（≤5 轉紅）。
	var snap: Dictionary = _playing_snap(you, {
		"turn": 1,  # B 思考中
		"phaseDeadline": Time.get_unix_time_from_system() * 1000.0 + 4000.0,
		"countdownMs": 4000,
	}, 15)
	snap["players"][1]["autoplay"] = true
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var countdown_label: Label = _table.get_node("%CountdownLabel")
	var is_red: bool = countdown_label.modulate.r > 0.8 and countdown_label.modulate.g < 0.4
	_check("C：託管中倒數文字轉紅", is_red, "color=%s" % countdown_label.modulate.to_html())

	# you=0 → B(seat1) 落在南面板（東→南→西→北 逆時針）。
	# 直接掃描四家面板的標題 Label，找 ⚠託管中 標籤。
	var found_tag := false
	var tag_text := ""
	for pname in ["EastPanel", "SouthPanel", "WestPanel", "NorthPanel"]:
		var panel: Node = _table.get_node(pname)
		for child in panel.get_children():
			if child is Label:
				tag_text = child.text
				if child.text.contains("⚠託管中"):
					found_tag = true
	_check("C：側邊面板顯示 ⚠託管中 標籤", found_tag,
		"text=%s" % tag_text)

	# 自己(you)被託管 → 狀態列應顯示「你已自動託管」。
	var me_snap: Dictionary = _playing_snap(you, {
		"phaseDeadline": Time.get_unix_time_from_system() * 1000.0 + 3000.0,
		"countdownMs": 3000,
	}, 15)
	me_snap["players"][0]["autoplay"] = true
	GameState.apply_snapshot(me_snap)
	await get_tree().process_frame
	await get_tree().process_frame
	var status_label: Label = _table.get_node("%StatusLabel")
	_check("C：自我託管狀態提示", status_label.text.contains("託管"),
		"text=%s" % status_label.text)


## 收集棄牌河中的牌面貼圖 tile_id（header Label 除外）。
func _river_tile_ids(river: Node) -> Array:
	var ids: Array = []
	for child in river.get_children():
		if child is TextureRect and child.has_meta("tile_id"):
			ids.append(str(child.get_meta("tile_id")))
	return ids


## 混合牌（刻意打亂）：1筒5、9萬、3條、中、梅、1萬、2筒、8條。
func _mixed_tiles() -> Array:
	return [
		{"instanceId": 1, "id": "tong:5"},
		{"instanceId": 2, "id": "wan:9"},
		{"instanceId": 3, "id": "tiao:3"},
		{"instanceId": 4, "id": "honor:zhong"},
		{"instanceId": 5, "id": "flower:mei"},
		{"instanceId": 6, "id": "wan:1"},
		{"instanceId": 7, "id": "tong:2"},
		{"instanceId": 8, "id": "tiao:8"},
	]


func _scenario_e() -> void:
	print("\n================= 情境 E：手牌自動理牌（Auto-Sort） =================")
	var you := 0
	var snap: Dictionary = _playing_snap(you, {}, 0)
	snap["players"][0]["hand"] = _mixed_tiles()
	snap["players"][0]["handCount"] = 8
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var labels: Array = []
	var all_textured := true
	for child in hand_area.get_children():
		if child is Button and child.tile_id != "":
			labels.append(GameState.tile_label(child.tile_id))
			# 貼圖渲染驗證：Button 不得有文字，且 Face TextureRect 必須有貼圖。
			if child.text != "":
				all_textured = false
			var face: TextureRect = child.get_node_or_null("Face")
			if face == null or face.texture == null:
				all_textured = false
	_check("E：手牌按鈕以貼圖渲染（無純文字）", all_textured)
	# 期望順序：萬(1,9) → 筒(2,5) → 條(3,8) → 字(中) → 花(梅)。
	var expected: Array = ["1萬", "9萬", "2筒", "5筒", "3條", "8條", "中", "梅"]
	_check("E：手牌依萬筒條字花排序", labels == expected,
		"實際=%s" % str(labels))

	# 相同牌（同花色同數字）以 instanceId 穩定排序。
	var dup_snap: Dictionary = _playing_snap(you, {}, 0)
	dup_snap["players"][0]["hand"] = [
		{"instanceId": 2, "id": "wan:5"},
		{"instanceId": 1, "id": "wan:5"},
	]
	dup_snap["players"][0]["handCount"] = 2
	GameState.apply_snapshot(dup_snap)
	# 平滑重排是背景動畫（淡出 0.15s + 滑動 0.22s）→ 輪詢等它完成。
	var reflowed := false
	var wait := 0
	while not reflowed and wait < 120:
		await get_tree().process_frame
		wait += 1
		if hand_area.get_children().size() == 2:
			reflowed = true
	var ids: Array = []
	for child in hand_area.get_children():
		if child is Button:
			ids.append(int(child.instance_id))
	_check("E：同張牌以 instanceId 穩定排序", reflowed and ids == [1, 2],
		"實際=%s（等待 %d 幀）" % [str(ids), wait])


func _scenario_f() -> void:
	print("\n================= 情境 F：對手牌背與中央棄牌河 =================")
	var you := 0
	# you=0 → 座次映射：0=SouthPanel 1=WestPanel 2=NorthPanel 3=EastPanel。
	# 對家 C(2) 在 NorthPanel 橫排；上家 B(1) WestPanel、下家 D(3) EastPanel 直列。
	var snap: Dictionary = _playing_snap(you, {
		"discardsBySeat": [
			["wan:1", "tong:2"],
			["tiao:3"],
			[],
			["honor:zhong", "wan:9", "flower:mei"],
		],
	}, 15)
	GameState.apply_snapshot(snap)
	# 上一情境（E）的重排動畫可能仍在播放：等佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	# F1：對手牌背。我方(South)不畫牌背，只畫手牌按鈕。
	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	_check("F：我方不畫牌背（僅手牌按鈕）", hand_area.get_children().size() == 15,
		"手牌按鈕 %d 顆" % hand_area.get_children().size())

	var north_backs: HBoxContainer = _table.get_node("%NorthHandBacks")
	var n_backs: int = 0
	var n_backs_textured := true
	for child in north_backs.get_children():
		if child is TextureRect:
			n_backs += 1
			if child.texture == null:
				n_backs_textured = false
	_check("F：對家橫排牌背 13-16 張（貼圖）", n_backs >= 13 and n_backs <= 16,
		"實際 %d 張" % n_backs)
	_check("F：對家牌背容器為 HBox（橫排）", north_backs is HBoxContainer)
	_check("F：對家牌背全部使用 back.png 貼圖", n_backs > 0 and n_backs_textured)

	var west_backs: VBoxContainer = _table.get_node("%WestHandBacks")
	var w_backs: int = 0
	var w_backs_textured := true
	for child in west_backs.get_children():
		if child is TextureRect:
			w_backs += 1
			if child.texture == null:
				w_backs_textured = false
	_check("F：上家(西側)直列牌背 13-14 張（貼圖）", w_backs >= 13 and w_backs <= 14,
		"實際 %d 張" % w_backs)
	_check("F：上家牌背全部使用 back.png 貼圖", w_backs > 0 and w_backs_textured)

	var east_backs: VBoxContainer = _table.get_node("%EastHandBacks")
	var e_backs: int = 0
	var e_backs_textured := true
	for child in east_backs.get_children():
		if child is TextureRect:
			e_backs += 1
			if child.texture == null:
				e_backs_textured = false
	_check("F：下家(東側)直列牌背 13-14 張（貼圖）", e_backs >= 13 and e_backs <= 14,
		"實際 %d 張" % e_backs)
	_check("F：下家牌背全部使用 back.png 貼圖", e_backs > 0 and e_backs_textured)

	# F2：中央牌桌四邊內緣的棄牌河（無 Label 標題，純牌面貼圖）。
	# 座次映射：seat0(South)→RiverBottom、seat1(West)→RiverLeft、
	#          seat2(North)→RiverTop、seat3(East)→RiverRight。
	var river_bottom: Control = _table.get_node("%RiverBottom")
	_check("F：RiverBottom(南/我) 棄牌貼圖 1萬/2筒",
		_river_tile_ids(river_bottom) == ["wan:1", "tong:2"],
		"實際=%s" % str(_river_tile_ids(river_bottom)))

	var river_left: Control = _table.get_node("%RiverLeft")
	_check("F：RiverLeft(西/上家) 棄牌貼圖 3條",
		_river_tile_ids(river_left) == ["tiao:3"],
		"實際=%s" % str(_river_tile_ids(river_left)))

	var river_top: Control = _table.get_node("%RiverTop")
	_check("F：RiverTop(北/對家) 無棄牌",
		_river_tile_ids(river_top).is_empty(),
		"實際=%s" % str(_river_tile_ids(river_top)))

	var river_right: Control = _table.get_node("%RiverRight")
	_check("F：RiverRight(東/下家) 棄牌貼圖 中/9萬/梅",
		_river_tile_ids(river_right) == ["honor:zhong", "wan:9", "flower:mei"],
		"實際=%s" % str(_river_tile_ids(river_right)))


func _scenario_g() -> void:
	print("\n================= 情境 G：第 17 張摸牌融合於手牌容器 =================")
	var you := 0
	# 17 張手牌 + 輪到我出牌 → 觸發摸牌分離（以伺服器 lastDrawnTile 辨識第 17 張）。
	var snap: Dictionary = _playing_snap(you, {
		"generationId": 3,
		"lastDrawnBy": you,
		"lastDrawnTile": {"instanceId": 17, "id": "wan:8"},
	}, 17)
	snap["turn"] = you
	GameState.apply_snapshot(snap)
	# 等動畫佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var children: Array = hand_area.get_children()
	# G1：第 17 張摸牌必須融合於同一 HBoxContainer（hand_area），不得有獨立 DrawSlot。
	var drawn_btn: Button = null
	var spacer: Control = null
	var btn_count := 0
	for child in children:
		if child is Button:
			btn_count += 1
			if child.has_meta("is_drawn_tile"):
				drawn_btn = child
		elif child is Control and child.has_meta("draw_spacer"):
			spacer = child
	_check("G：第 17 張摸牌融合於 hand_area（無獨立 DrawSlot）",
		drawn_btn != null and btn_count == 17,
		"按鈕 %d 顆" % btn_count)
	_check("G：第 16/17 張之間有 24px 透明間隔器（明顯空格）",
		spacer != null and spacer.custom_minimum_size.x == 24.0,
		"spacer 寬=%s" % (str(spacer.custom_minimum_size.x) if spacer else "無"))
	# G2：間隔器與第 17 張摸牌必須位於容器末端（最後兩個子節點）。
	var last_idx: int = children.size() - 1
	var spacer_idx: int = children.find(spacer) if spacer else -1
	var drawn_idx: int = children.find(drawn_btn) if drawn_btn else -1
	_check("G：間隔器與摸牌位於手牌最右側（容器末端）",
		spacer_idx == last_idx - 1 and drawn_idx == last_idx,
		"spacer@%d drawn@%d total=%d" % [spacer_idx, drawn_idx, children.size()])
	# G3：摸牌按鈕以貼圖渲染（無純文字）— 檢查 Face(TextureRect) 節點貼圖。
	var face_tex: Texture2D = null
	if drawn_btn != null and drawn_btn.has_node("Face"):
		face_tex = drawn_btn.get_node("Face").texture
	_check("G：第 17 張摸牌以貼圖渲染", face_tex != null,
		"texture=%s" % (str(face_tex) if face_tex else "無"))


func _scenario_g2() -> void:
	print("\n================= 情境 G2：第 17 張以伺服器 lastDrawnTile 辨識（非 max-instanceId） =================")
	var you := 0
	# 構造 17 張手牌：真正摸到的牌 instanceId=7（wan:8），而手牌中存在更大的
	# instanceId=90（wan:5）。舊版 max-instanceId 啟發式會誤分 90 → 進牌混進手牌。
	var hand17: Array = []
	for i in range(1, 18):
		hand17.append({"instanceId": i, "id": "wan:%d" % ((i % 9) + 1)})
	hand17[3] = {"instanceId": 90, "id": "wan:5"}
	var snap: Dictionary = _playing_snap(you, {
		"generationId": 4,
		"lastDrawnBy": you,
		"lastDrawnTile": {"instanceId": 7, "id": "wan:8"},
	}, 17)
	snap["turn"] = you
	snap["players"][0]["hand"] = hand17
	snap["players"][0]["handCount"] = 17
	GameState.apply_snapshot(snap)
	# 等動畫佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	# 直接驗證分離邏輯：drawn 必須是 instanceId=7，而非 max-instanceId=90。
	var full_hand: Array = _table._sorted_hand(GameState.my_hand())
	var split: Array = _table._split_drawn_tile(full_hand)
	var drawn: Dictionary = split[1]
	var drawn_id: int = int(drawn.get("instanceId", -1)) if drawn != null else -1
	var max_inst := -1
	for t in full_hand:
		max_inst = maxi(max_inst, int(t.get("instanceId", -1)))
	_check("G2：手牌存在比摸牌更大之 instanceId（測試有效）", max_inst == 90,
		"max=%d" % max_inst)
	_check("G2：第 17 張 = 伺服器 lastDrawnTile(7)，非 max-instanceId(90)",
		drawn_id == 7, "drawn=%d" % drawn_id)

	# 驗證實際渲染：hand_area 末端的分離摸牌按鈕 instanceId 也必須是 7。
	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var rendered_drawn := -1
	for child in hand_area.get_children():
		if child is Button and child.has_meta("is_drawn_tile"):
			rendered_drawn = int(child.instance_id)
			break
	_check("G2：渲染出的摸牌按鈕為 instanceId=7", rendered_drawn == 7,
		"rendered=%d" % rendered_drawn)


## 情境 MULTI-ROUND：連續打了三手後，手牌 24px 間隔器不得重複累積，間距保持精確固定。
func _scenario_multi_round() -> void:
	print("\n================= 情境 MULTI-ROUND：連續多局手牌與間隔器無記憶體/節點累積 =================")
	for round_num in range(1, 4):
		var snap := _playing_snap(0)
		snap["generationId"] = 100 + round_num
		snap["status"] = "playing"
		snap["phase"] = "discard"
		snap["turn"] = GameState.you
		snap["lastDrawnBy"] = GameState.you
		# 手牌 17 張
		var hand17: Array = []
		for i in range(16):
			hand17.append({"instanceId": round_num * 1000 + i, "id": "wan:%d" % ((i % 9) + 1)})
		var drawn_inst: int = round_num * 1000 + 88
		hand17.append({"instanceId": drawn_inst, "id": "tiao:8"})
		snap["lastDrawnTile"] = {"instanceId": drawn_inst, "id": "tiao:8"}
		snap["players"][0]["hand"] = hand17
		snap["players"][0]["handCount"] = 17
		GameState.apply_snapshot(snap)
		await get_tree().process_frame
		await get_tree().process_frame

		var hand_area: HBoxContainer = _table.get_node("%HandArea")
		var spacer_count := 0
		var spacer_width := 0.0
		for child in hand_area.get_children():
			if child is Control and child.has_meta("draw_spacer"):
				spacer_count += 1
				spacer_width = child.custom_minimum_size.x

		_check("MULTI-ROUND：第 %d 局摸牌間隔器數量剛好為 1 個（無重複累積）" % round_num,
			spacer_count == 1, "第 %d 局 實際 spacer 數=%d" % [round_num, spacer_count])
		_check("MULTI-ROUND：第 %d 局摸牌間距保持 24px（無漸進拉大）" % round_num,
			spacer_width == 24.0, "第 %d 局 實際 spacer 寬=%.1f" % [round_num, spacer_width])


func _scenario_h() -> void:
	print("\n================= 情境 H：Wikimedia 3D 圖庫字牌貼圖對應 =================")
	# 後端 honor 代號 → Wikimedia 3D 圖庫檔名（tile_loader.gd HONOR_TO_WIKIMEDIA）。
	# 驗證方式：對應 PNG 檔存在於 res://assets/tiles/ 且 face_texture() 回傳非空貼圖。
	# （未匯入的 PNG 以 Image.load_from_file() 建立 ImageTexture，resource_path 為空，
	#   故以「檔案存在 + 貼圖非空」判定，而非 resource_path / 尺寸。）
	var honor_map := {
		"honor:dong": "east.png",
		"honor:nan": "south.png",
		"honor:xi": "west.png",
		"honor:bei": "north.png",
		"honor:zhong": "red.png",
		"honor:fa": "green.png",
		"honor:bai": "white.png",
	}
	var all_ok := true
	var detail := ""
	for tile_id in honor_map:
		var fname: String = honor_map[tile_id]
		var file_ok: bool = FileAccess.file_exists("res://assets/tiles/" + fname)
		var tex: Texture2D = TileLoader.face_texture(tile_id)
		var tex_ok: bool = tex != null
		if not (file_ok and tex_ok):
			all_ok = false
			detail += "%s→%s(file=%s,tex=%s) " % [tile_id, fname, file_ok, tex_ok]
	_check("H：字牌 honor 對應 Wikimedia 檔名（east/south/west/north/red/green/white）",
		all_ok, detail.strip_edges())
	# 萬筒條 + 牌背亦應載入貼圖（對應 PNG 檔存在 + 貼圖非空）。
	var suits_ok := true
	for cat in ["wan", "tong", "tiao"]:
		for n in range(1, 10):
			var tex: Texture2D = TileLoader.face_texture("%s:%d" % [cat, n])
			if tex == null or not FileAccess.file_exists("res://assets/tiles/%s_%d.png" % [cat, n]):
				suits_ok = false
	var back_tex: Texture2D = TileLoader.back_texture()
	var back_ok: bool = back_tex != null and FileAccess.file_exists("res://assets/tiles/back.png")
	_check("H：萬筒條 1-9 與牌背皆載入貼圖", suits_ok and back_ok)


func _scenario_i() -> void:
	print("\n================= 情境 I：資產映射 100% 對齊 + apply_face 塞入 =================")
	# 1) validate_assets() 應回傳空清單（43 個檔名全部存在於 assets/tiles/）。
	var missing: Array = TileLoader.validate_assets()
	_check("I：validate_assets() 無缺失（43 檔全在）", missing.is_empty(),
		"missing=%s" % str(missing))
	# 2) apply_face() 應能把貼圖正確塞入 TextureRect，且 meta.tile_id 同步。
	var tr := TextureRect.new()
	var apply_ok := true
	var apply_detail := ""
	for tile_id in ["wan:5", "tong:3", "tiao:7", "honor:zhong", "flower:mei"]:
		TileLoader.apply_face(tr, tile_id)
		if tr.texture == null or tr.get_meta("tile_id", "") != tile_id:
			apply_ok = false
			apply_detail += "%s(tex=%s,meta=%s) " % [
				tile_id, tr.texture != null, tr.get_meta("tile_id", "")]
	_check("I：apply_face() 正確塞入 TextureRect 並同步 meta", apply_ok, apply_detail.strip_edges())
	tr.free()

	# 3) 所有合法 TileId 都應回傳非空貼圖（涵蓋萬筒條/字/花/牌背）。
	var all_tex_ok := true
	var tex_detail := ""
	for cat in ["wan", "tong", "tiao"]:
		for n in range(1, 10):
			if TileLoader.face_texture("%s:%d" % [cat, n]) == null:
				all_tex_ok = false
				tex_detail += "%s:%d " % [cat, n]
	for honor in ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"]:
		if TileLoader.face_texture("honor:" + honor) == null:
			all_tex_ok = false
			tex_detail += "honor:%s " % honor
	for flower in ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"]:
		if TileLoader.face_texture("flower:" + flower) == null:
			all_tex_ok = false
			tex_detail += "flower:%s " % flower
	if TileLoader.back_texture() == null:
		all_tex_ok = false
		tex_detail += "back "
	_check("I：全部 43 種 TileId 皆回傳非空貼圖", all_tex_ok, tex_detail.strip_edges())


func _scenario_d() -> void:
	print("\n================= 情境 D：連莊與結算帳本 =================")
	var you := 0
	var snap: Dictionary = _ended_snap()
	snap["dealer"] = 0
	snap["dealerStreak"] = 3
	snap["winner"] = 0
	snap["settlement"] = {
		"winner": 0, "selfDraw": true, "kongDraw": false,
		"breakdown": {
			"fans": [
				{"rule": "自摸", "value": 1},
				{"rule": "莊家連莊台", "value": 2},  # streak=3 → 連莊台 2
			],
			"total": 3,
		},
		"ledger": [
			{"seat": 0, "delta": 900},
			{"seat": 1, "delta": -300},
			{"seat": 2, "delta": -300},
			{"seat": 3, "delta": -300},
		],
		"scores": [3900, 100, 100, 100],
	}
	# 我尚未準備 → 「準備下一局」按鈕應可用。
	snap["players"][0]["ready"] = false
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("D：結算面板顯示", settlement_panel.visible)

	var detail: Label = _table.get_node("%SettlementDetail")
	var text: String = detail.text
	_check("D：結算面板標題列含莊家/贏家", text.contains("莊家") and text.contains("贏家"),
		"text=%s" % text)

	# 台數明細與分數帳本已移至 FanListContainer（逐項淡入上滑的獨立 Label）。
	var fan_list: VBoxContainer = _table.get_node("%FanListContainer")
	var has_lianzhuang := false
	var has_delta := false
	var has_pos := false
	var has_neg := false
	for child in fan_list.get_children():
		if child is Label:
			var t: String = child.text
			if t.contains("莊家連莊台"):
				has_lianzhuang = true
			if t.contains("+900"):
				has_pos = true
			if t.contains("-300"):
				has_neg = true
	_check("D：台數明細含連莊台(+2)", has_lianzhuang)
	_check("D：四家 ledger delta 顯示（+900 / -300）", has_pos and has_neg,
		"莊+900 三家-300")

	var dealer_info: Label = _table.get_node("%DealerInfoLabel")
	_check("D：TopBar 顯示連莊", dealer_info.text.contains("連莊 3"),
		"text=%s" % dealer_info.text)

	var next_btn: Button = _table.get_node("%NextRoundBtn")
	_check("D：準備下一局按鈕可用", next_btn.visible and not next_btn.disabled)


func _scenario_draw() -> void:
	print("\n================= 情境 DRAW：流局結算（winner=null 不崩潰） =================")
	var you := 0
	var snap: Dictionary = _ended_snap()
	snap["status"] = "ended"
	snap["winner"] = null
	# server 流局時 settlement 非空（全 0 ledger），但 winner/breakdown 皆 null。
	snap["settlement"] = {
		"winner": null, "selfDraw": false, "kongDraw": false,
		"breakdown": null,
		"ledger": [
			{"seat": 0, "delta": 0},
			{"seat": 1, "delta": 0},
			{"seat": 2, "delta": 0},
			{"seat": 3, "delta": 0},
		],
		"scores": [0, 0, 0, 0],
	}
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	# 流局 → 結算面板顯示「流局」，不得崩潰、不印「贏家」。
	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("DRAW：流局結算面板顯示", settlement_panel.visible)
	var detail: Label = _table.get_node("%SettlementDetail")
	_check("DRAW：結算標題含「流局」", detail.text.contains("流局"),
		"text=%s" % detail.text)
	_check("DRAW：流局不誤印「贏家」", not detail.text.contains("贏家："),
		"text=%s" % detail.text)


## 情境 NULL-SNAP：settlement=null 且 winner=null（playing 快照）不得崩潰。
## 這是「反應窗開啟中」或「剛發牌」等 server 不填 settlement 的常見路徑。
func _scenario_null_settlement() -> void:
	print("\n================= 情境 NULL-SNAP：settlement/winner/breakdown 全 null =================" )
	# 快照：playing 狀態，所有 nullable 字段皆為 null。
	var snap: Dictionary = _playing_snap(0, {}, 13)
	snap["winner"] = null
	snap["settlement"] = null
	snap["lastDiscard"] = null
	snap["lastDiscardBy"] = null
	snap["lastDrawnTile"] = null
	snap["reactionHint"] = null
	snap["phaseDeadline"] = null
	snap["countdownMs"] = null
	snap["autoplayLog"] = null
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	# 只要不崩潰、GameState 無丟 null 進 typed int 即通過。
	_check("NULL-SNAP：apply_snapshot 全 null nullable 不崩潰", true)
	_check("NULL-SNAP：winner 落地為 -1", GameState.winner == -1,
		"got %d" % GameState.winner)
	_check("NULL-SNAP：last_discard_by 落地為 -1", GameState.last_discard_by == -1,
		"got %d" % GameState.last_discard_by)
	_check("NULL-SNAP：countdown_ms 落地為 -1", GameState.countdown_ms == -1,
		"got %d" % GameState.countdown_ms)
	_check("NULL-SNAP：autoplay_log 落地為空陣列", GameState.autoplay_log == [],
		"got %s" % str(GameState.autoplay_log))

	# 流局快照（ended + settlement 含 null winner/breakdown）確認 _render_settlement 不崩。
	var draw_snap: Dictionary = _ended_snap()
	draw_snap["winner"] = null
	draw_snap["settlement"] = {
		"winner": null, "selfDraw": false, "kongDraw": false,
		"breakdown": null,
		"ledger": [
			{"seat": 0, "delta": 0}, {"seat": 1, "delta": 0},
			{"seat": 2, "delta": 0}, {"seat": 3, "delta": 0},
		],
		"scores": [0, 0, 0, 0],
	}
	GameState.apply_snapshot(draw_snap)
	await get_tree().process_frame
	await get_tree().process_frame
	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("NULL-SNAP：流局結算面板顯示（settlement.winner=null）", settlement_panel.visible)
	var detail: Label = _table.get_node("%SettlementDetail")
	_check("NULL-SNAP：流局不誤印「贏家：」", not detail.text.contains("贏家："),
		"text=%s" % detail.text)


func _ready() -> void:
	# 在專案正常啟動（autoload 已載入）後載入 Table.tscn。
	_table = TableScene.instantiate()
	add_child(_table)
	_run.call_deferred()


func _run() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	await _scenario_b()
	await _scenario_c()
	await _scenario_d()
	await _scenario_draw()
	await _scenario_null_settlement()
	await _scenario_e()
	await _scenario_f()
	await _scenario_g()
	await _scenario_g2()
	await _scenario_multi_round()
	await _scenario_h()
	await _scenario_i()

	print("\n================ QA 客戶端渲染報告 ================")
	print("PASS %d / FAIL %d" % [_pass, _fail])
	for c in _checks:
		print("  %s %s%s" % ["✅" if c[1] else "❌", c[0], (" (%s)" % c[2]) if c[2] != "" else ""])
	print("==================================================")
	get_tree().quit(0 if _fail == 0 else 1)
