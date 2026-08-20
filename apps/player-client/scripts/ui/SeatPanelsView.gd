extends RefCounted

## SeatPanelsView — 四家側邊面板渲染器 (UI View Component)
## 負責渲染玩家姓名、風位、手牌張數標籤、莊/託管/離線視覺標籤、
## 對家手牌牌背與副露 (Melds) 區。

const GLASS_BG := Color("#121212CC")
const GOLD_BORDER := Color("#D4AF3766")
const GOLD_TEXT := Color("#F3E5AB")
const GOLD_TEXT_DIM := Color(0.9, 0.85, 0.7, 1)

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
		# 清除舊的標題/張數標籤（保留 MeldArea / HandBacks 結構）。
		for child in box.get_children():
			if child is Label:
				child.queue_free()
		var p: Dictionary = table_ref.call("_player_view", seat)
		var who: String = "（我）" if seat == game_state.you else ""
		var tag: String = player_tag(seat, p, game_state)
		var wind_name: String = table_ref.call("_wind_name", seat)
		var is_turn: bool = game_state.is_playing() and seat == game_state.turn
		var turn_indicator := ""
		if is_turn:
			turn_indicator = " 👈 輪到你" if seat == game_state.you else " 👉 出牌中"
		var title := Label.new()
		title.text = "%s %s (%d 張)%s%s%s" % [
			game_state.seat_name(seat), wind_name, p.get("handCount", 0), who, tag, turn_indicator,
		]
		var bg_color := Color("#2A200BEE") if is_turn else GLASS_BG
		var border_color := Color("#FFD700FF") if is_turn else GOLD_BORDER
		var font_color := Color("#FFF080") if is_turn else GOLD_TEXT
		var style: StyleBoxFlat = table_ref.call("_make_style", bg_color, border_color, 6)
		if is_turn:
			style.border_width_left = 2
			style.border_width_right = 2
			style.border_width_top = 2
			style.border_width_bottom = 2
		table_ref.call("_style_label", title, style, font_color, 15)
		box.add_child(title)
		box.move_child(title, 0)
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


func player_tag(seat: int, p: Dictionary, game_state: Object) -> String:
	var tags: Array = []
	if seat == game_state.dealer:
		if game_state.dealer_streak > 0:
			tags.append("[莊·連%d]" % game_state.dealer_streak)
		else:
			tags.append("[莊]")
	if p.get("autoplay", false):
		tags.append("⚠託管中")
	elif not p.get("connected", false):
		tags.append("⚡離線")
	if tags.is_empty():
		return ""
	return " " + " ".join(tags)


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
		table_ref.call("_style_label", kind_tag, style, GOLD_TEXT_DIM, 12)
		box.add_child(kind_tag)
		for t in m.get("tiles", []):
			box.add_child(TileLoader.make_tile_rect(str(t), Vector2(40, 53)))
