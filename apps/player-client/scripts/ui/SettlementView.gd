extends Node
## SettlementView — 結算面板渲染（單向輸出 view）。
##
## 職責：結算面板顯示／隱藏、台數逐行淡入、ledger +/-、流局不印「贏家：」、
## 「準備下一局」按鈕狀態。持有 %SettlementPanel/%SettlementDetail/
## %FanListContainer/%NextRoundBtn/%SettlementBackdrop。
## 對齊 QA：D 情境（連莊／ledger）、DRAW（流局）、NULL-SNAP（winner=null 不崩）。

## 雀魂風格色票（與 table.gd 一致）。
const GOLD_TEXT := Color("#F3E5AB")
const GOLD_TEXT_DIM := Color(0.9, 0.85, 0.7, 1)
const GLASS_BG := Color("#121212CC")
const GOLD_BORDER := Color("#D4AF3766")
const SCORE_POS := Color("#2ECC71")
const SCORE_NEG := Color("#E74C3C")

@onready var panel: PanelContainer = %SettlementPanel
@onready var backdrop: ColorRect = %SettlementBackdrop
@onready var title: Label = %SettlementTitle
@onready var detail: Label = %SettlementDetail
@onready var fan_list: VBoxContainer = %FanListContainer
@onready var next_round_btn: Button = %NextRoundBtn


## 顯示結算並填入內容（流局判定用 winner==null）。
func show(game_state: Node) -> void:
	panel.visible = true
	backdrop.visible = true
	title.text = "本局結束"
	for c in fan_list.get_children():
		c.queue_free()

	var header: Array = []
	header.append("莊家：%s（%s風 第 %d 局）" % [
		game_state.seat_name(game_state.dealer),
		_wind_name(game_state.dealer),
		game_state.dealer_streak,
	])
	var s: Dictionary = game_state.settlement
	var line_index := 0
	var winner_v: Variant = s.get("winner", -1) if not s.is_empty() else null
	if winner_v == null:
		title.text = "⚪ 流局（和局）"
		header.append("流局（和局）")
	else:
		var winner: int = int(winner_v)
		if winner == game_state.you:
			title.text = "👑 榮和勝利！ (VICTORY)" if not s.get("selfDraw", false) else "🌟 絕張自摸！ (TSUMO)"
		else:
			title.text = "✦ 對局結算 (ROUND OVER)"
		header.append("贏家：%s" % game_state.seat_name(winner))
		if s.get("selfDraw", false):
			header.append("自摸（系統自動胡）")
		elif s.get("kongDraw", false):
			header.append("槓上開花（系統自動胡）")
		elif game_state.last_discard_by >= 0:
			header.append("放槍胡（%s 放槍，系統自動胡）" % game_state.seat_name(game_state.last_discard_by))
		var breakdown_v: Variant = s.get("breakdown", null)
		var breakdown: Dictionary = breakdown_v if breakdown_v is Dictionary else {}
		line_index = _render_fans(breakdown, line_index)
		line_index = _render_ledger(s, game_state.dealer, line_index)
	if not game_state.autoplay_log.is_empty():
		var al := Label.new()
		al.text = "自動託管：%s" % game_state.autoplay_summary()
		_styled(al, GOLD_TEXT_DIM, 14)
		fan_list.add_child(al)

	# 可證明公平性 (Provably Fair) 開牌稽核按鈕
	var pf: Dictionary = game_state.provably_fair
	var proof_v: Variant = pf.get("proof", null)
	if proof_v is Dictionary and not proof_v.is_empty():
		var pf_btn := Button.new()
		pf_btn.text = "⚖️ 驗證本局公平性 (Provably Fair Audit)"
		pf_btn.custom_minimum_size = Vector2(0, 36)
		pf_btn.pressed.connect(func():
			var s_seed: String = str(proof_v.get("serverSeed", ""))
			var s_hash: String = str(proof_v.get("serverSeedHash", ""))
			var c_seed: String = str(proof_v.get("clientSeed", ""))
			var nonce: int = int(proof_v.get("nonce", 1))
			var url := "http://localhost:3000/verify?serverSeed=%s&serverSeedHash=%s&clientSeed=%s&nonce=%d" % [s_seed, s_hash, c_seed, nonce]
			if OS.has_feature("web"):
				url = "/verify?serverSeed=%s&serverSeedHash=%s&clientSeed=%s&nonce=%d" % [s_seed, s_hash, c_seed, nonce]
			OS.shell_open(url)
		)
		fan_list.add_child(pf_btn)

	detail.text = "\n".join(header)
	var my_ready := false
	for p in game_state.players:
		if int(p.get("seat", -1)) == game_state.you and p.get("ready", false):
			my_ready = true
			break
	next_round_btn.disabled = my_ready
	next_round_btn.text = "已準備 ✓" if my_ready else "準備下一局"


## 台數逐行淡入（對應 QA D：fan 含「莊家連莊台」）。
func _render_fans(breakdown: Dictionary, line_index: int) -> int:
	if breakdown.is_empty():
		return line_index
	var fans: Array = breakdown.get("fans", [])
	var total: int = int(breakdown.get("total", 0))
	var title_line := Label.new()
	title_line.text = "— 台數明細（共 %d 台）—" % total
	title_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_styled(title_line, GOLD_TEXT, 16)
	_animate_in(title_line, line_index)
	line_index += 1
	for f in fans:
		var fl := Label.new()
		fl.text = "✦ %s  +%d 台" % [str(f.get("rule", "?")), int(f.get("value", 0))]
		fl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_styled(fl, GOLD_TEXT, 15)
		_animate_in(fl, line_index)
		line_index += 1
	return line_index


## 帳本逐行（放槍者付最多／零和顯示；流局全 0 也顯示）。
func _render_ledger(s: Dictionary, dealer: int, line_index: int) -> int:
	if s.get("ledger", []).is_empty():
		return line_index
	var sep := Label.new()
	sep.text = "— 分數結算 —"
	sep.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_styled(sep, GOLD_TEXT, 16)
	_animate_in(sep, line_index)
	line_index += 1
	var scores: Array = s.get("scores", [])
	for e in s.get("ledger", []):
		var seat: int = int(e.get("seat", -1))
		var delta: int = int(e.get("delta", 0))
		var total_score: int = scores[seat] if seat >= 0 and seat < scores.size() else 0
		var tag: String = "（莊）" if seat == dealer else ""
		var sign: String = "+" if delta > 0 else ""
		var cl := Label.new()
		cl.text = "%s%s：%s%d 分（累計 %d）" % [GameState.seat_name(seat), tag, sign, delta, total_score]
		cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_styled(cl, SCORE_POS if delta > 0 else SCORE_NEG, 15)
		_animate_in(cl, line_index)
		line_index += 1
	return line_index


## 以莊家為東回傳風向。
func _wind_name(seat: int) -> String:
	var winds := ["東", "南", "西", "北"]
	if GameState.dealer < 0:
		return ""
	return winds[(seat - GameState.dealer + 4) % 4]


## 套用玻璃金邊樣式 + 細節字體。
func _styled(lbl: Label, color: Color, font_size: int) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = GLASS_BG
	sb.border_color = GOLD_BORDER
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.corner_radius_top_left = 6
	sb.corner_radius_top_right = 6
	sb.corner_radius_bottom_left = 6
	sb.corner_radius_bottom_right = 6
	sb.content_margin_left = 12
	sb.content_margin_top = 6
	sb.content_margin_right = 12
	sb.content_margin_bottom = 6
	lbl.add_theme_stylebox_override("normal", sb)
	lbl.add_theme_color_override("font_color", color)
	lbl.add_theme_font_size_override("font_size", font_size)


## 淡入上滑（節點離樹前同步完成）。
func _animate_in(lbl: Label, index: int) -> void:
	fan_list.add_child(lbl)
	lbl.modulate.a = 0.0
	await get_tree().process_frame
	if not is_inside_tree() or not is_instance_valid(lbl) or lbl.get_parent() != fan_list:
		return
	var base: Vector2 = lbl.position
	lbl.position = base + Vector2(0, 14)
	var tw := create_tween()
	tw.tween_interval(0.06 * index)
	tw.tween_property(lbl, "position", base, 0.32) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(lbl, "modulate:a", 1.0, 0.32)


## 隱藏結算（回到 lobby／新局）。
func hide() -> void:
	panel.visible = false
	backdrop.visible = false
	for c in fan_list.get_children():
		c.queue_free()
