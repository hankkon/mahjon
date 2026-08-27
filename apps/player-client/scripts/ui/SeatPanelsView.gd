extends RefCounted

## SeatPanelsView — 四家側邊面板渲染器 (UI View Component)
## 負責渲染玩家資訊卡片（門風徽章、相對稱謂、玩家名稱、手牌張數、莊/託管標籤）、
## 對家手牌牌背與副露 (Melds) 區。
##
## 視覺分層設計：
## 1. 門風 Badge：獨立小徽章（深底金框 / 莊家赤金底），清晰辨別門風
## 2. 玩家姓名行：強調相對稱謂（我 / 上家 / 對家 / 下家）與玩家名
## 3. 次要資訊行：手牌張數與狀態標籤（⚠託管、⚡離線、👉出牌中）縮小低調呈現

const GLASS_BG := Color("#121212EE")
const GLASS_BG_ACTIVE := Color("#2A200BEE")
const GOLD_BORDER := Color("#D4AF3755")
const GOLD_BORDER_ACTIVE := Color("#FFD700FF")
const GOLD_TEXT := Color("#FFF080")
const IVORY_TEXT := Color("#F3E5AB")
const SUB_TEXT := Color("#C4B490")
const BADGE_DEALER_BG := Color("#5C1D0D")
const BADGE_WIND_BG := Color("#1A2430")
const BADGE_WIND_BORDER := Color("#D4AF3788")

var table_ref: Object


func _init(table: Object) -> void:
	table_ref = table


func render_side_panels(seat_to_panel: Dictionary, opponent_backs: Dictionary, game_state: Object) -> void:
	if table_ref == null:
		return
	for seat in range(4):
		var panel_name: String = seat_to_panel.get(seat, "")
		if panel_name == "":
			continue
		var box: VBoxContainer = table_ref.get_node(panel_name)
		if not box:
			continue

		# 清除舊的 PlayerCard / 標籤（保留 MeldArea 與 HandBacks 結構）。
		for child in box.get_children():
			if child.name.begins_with("PlayerCard") or child is Label or child.has_meta("is_player_card"):
				child.queue_free()

		var p: Dictionary = table_ref.call("_player_view", seat)
		var diff: int = (seat - game_state.you + 4) % 4
		var is_me: bool = (diff == 0)
		var rel_role := ""
		match diff:
			0: rel_role = "我"
			1: rel_role = "下家"
			2: rel_role = "對家"
			3: rel_role = "上家"

		var is_turn: bool = game_state.is_playing() and seat == game_state.turn
		var is_dealer: bool = (seat == game_state.dealer)
		var wind_name: String = table_ref.call("_wind_name", seat)

		# 建立結構化 PlayerCard (PanelContainer)
		var card := PanelContainer.new()
		card.name = "PlayerCard_%d" % seat
		card.set_meta("is_player_card", true)

		var card_bg := GLASS_BG_ACTIVE if is_turn else GLASS_BG
		var card_border := GOLD_BORDER_ACTIVE if is_turn else GOLD_BORDER
		var card_style: StyleBoxFlat = table_ref.call("_make_style", card_bg, card_border, 8, 2 if is_turn else 1)
		card_style.content_margin_left = 8
		card_style.content_margin_right = 8
		card_style.content_margin_top = 4
		card_style.content_margin_bottom = 4
		card.add_theme_stylebox_override("panel", card_style)

		var content_vbox := VBoxContainer.new()
		content_vbox.add_theme_constant_override("separation", 2)
		card.add_child(content_vbox)

		# --- Row 1: 門風 Badge + 稱謂與玩家名稱 + 出牌指示 ---
		var row1 := HBoxContainer.new()
		row1.add_theme_constant_override("separation", 6)
		content_vbox.add_child(row1)

		# 門風 Badge (獨立圓角小徽章)
		if wind_name != "":
			var wind_badge := Label.new()
			var badge_text := wind_name
			if is_dealer:
				badge_text = "%s·莊" % wind_name if game_state.dealer_streak == 0 else "%s·連%d" % [wind_name, game_state.dealer_streak]
			wind_badge.text = badge_text
			var badge_bg := BADGE_DEALER_BG if is_dealer else BADGE_WIND_BG
			var badge_border := GOLD_BORDER_ACTIVE if is_dealer else BADGE_WIND_BORDER
			var badge_style: StyleBoxFlat = table_ref.call("_make_style", badge_bg, badge_border, 4, 1)
			badge_style.content_margin_left = 5
			badge_style.content_margin_right = 5
			badge_style.content_margin_top = 1
			badge_style.content_margin_bottom = 1
			table_ref.call("_style_label", wind_badge, badge_style, GOLD_TEXT if is_dealer else IVORY_TEXT, 12)
			row1.add_child(wind_badge)

		# 稱謂與玩家名稱 Label
		var name_lbl := Label.new()
		var p_name: String = game_state.seat_name(seat)
		if is_me:
			name_lbl.text = "【我】%s" % p_name
		else:
			name_lbl.text = "【%s】%s" % [rel_role, p_name]
		name_lbl.add_theme_color_override("font_color", GOLD_TEXT if (is_me or is_turn) else IVORY_TEXT)
		name_lbl.add_theme_font_size_override("font_size", 14)
		row1.add_child(name_lbl)

		# 出牌提示 (若是輪到出牌)
		if is_turn:
			var turn_lbl := Label.new()
			turn_lbl.text = "👈 輪到你" if is_me else "👉 出牌中"
			turn_lbl.add_theme_color_override("font_color", GOLD_TEXT)
			turn_lbl.add_theme_font_size_override("font_size", 12)
			row1.add_child(turn_lbl)

		# --- Row 2: 點數 + 手牌張數 + 託管/離線狀態標籤 ---
		var row2 := HBoxContainer.new()
		row2.add_theme_constant_override("separation", 8)
		content_vbox.add_child(row2)

		var seat_scores: Array = game_state.scores if "scores" in game_state else []
		var cur_score: int = int(seat_scores[seat]) if seat < seat_scores.size() else 0
		var score_lbl := Label.new()
		score_lbl.text = "🪙 %d" % cur_score
		score_lbl.add_theme_color_override("font_color", GOLD_TEXT if cur_score >= 0 else Color("#E57373"))
		score_lbl.add_theme_font_size_override("font_size", 12)
		row2.add_child(score_lbl)

		var hand_count_lbl := Label.new()
		hand_count_lbl.text = "%d 張" % int(p.get("handCount", 0))
		hand_count_lbl.add_theme_color_override("font_color", SUB_TEXT)
		hand_count_lbl.add_theme_font_size_override("font_size", 12)
		row2.add_child(hand_count_lbl)

		# 狀態標籤 (託管 / 離線)
		if p.get("autoplay", false):
			var auto_tag := Label.new()
			auto_tag.text = "⚠託管中"
			auto_tag.add_theme_color_override("font_color", Color("#FFA726"))
			auto_tag.add_theme_font_size_override("font_size", 12)
			row2.add_child(auto_tag)
		elif not p.get("connected", false):
			var off_tag := Label.new()
			off_tag.text = "⚡離線"
			off_tag.add_theme_color_override("font_color", Color("#EF5350"))
			off_tag.add_theme_font_size_override("font_size", 12)
			row2.add_child(off_tag)

		box.add_child(card)
		box.move_child(card, 0)

		render_melds(seat, panel_name, p)
		# Majsoul compact opponent hand backs (back.png via TileLoader).
		if seat != game_state.you and game_state.is_playing():
			render_hand_backs(seat, panel_name, opponent_backs, p)


func make_tile_back(tile_size: Vector2) -> TextureRect:
	return TileLoader.make_back_rect(tile_size)


func render_hand_backs(seat: int, panel_name: String, opponent_backs: Dictionary, p: Dictionary) -> void:
	if not opponent_backs.has(panel_name):
		return
	var box: Container = opponent_backs[panel_name]
	for child in box.get_children():
		child.queue_free()
	var count: int = clampi(int(p.get("handCount", 0)), 13, 17)
	var horizontal: bool = box is HBoxContainer
	var tile_size := Vector2(26, 36) if horizontal else Vector2(22, 30)
	var show: int = count if horizontal else mini(count, 13)
	for i in range(show):
		box.add_child(make_tile_back(tile_size))


const MELD_CN := {
	"chi": "吃",
	"peng": "碰",
	"kong": "槓",
	"dark_kong": "暗槓",
	"add_kong": "補槓",
}


func render_melds(seat: int, panel_name: String, p: Dictionary) -> void:
	var box: HBoxContainer = table_ref.get_node("%s/MeldArea" % panel_name)
	if not box:
		return
	for child in box.get_children():
		child.queue_free()
	for m in p.get("melds", []):
		var kind: String = str(m.get("kind", "?"))
		var kind_cn: String = MELD_CN.get(kind, kind)
		var kind_tag := Label.new()
		kind_tag.text = "[%s]" % kind_cn
		var style: StyleBoxFlat = table_ref.call("_make_style", GLASS_BG, GOLD_BORDER, 4)
		table_ref.call("_style_label", kind_tag, style, SUB_TEXT, 12)
		box.add_child(kind_tag)
		for t in m.get("tiles", []):
			box.add_child(TileLoader.make_tile_rect(str(t), Vector2(40, 53)))

