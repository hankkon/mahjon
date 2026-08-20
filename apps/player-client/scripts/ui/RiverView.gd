extends Node
## RiverView — 中央四河 TextureRect 渲染（單向輸出 view）。
##
## 職責：持有四河（%RiverBottom/Top/Left/Right）的池化槽位，
## 接收「座次→河」對應與各家棄牌，更新貼圖（TileLoader.apply_face），
## 提供 slot 查詢給 table.gd 的飛行動畫／最後棄牌標記／同款高亮。
## 不判斷規則；行為與原 table.gd 一致（QA 情境 F 依賴）。

## 每河最多 24 個槽位（4 行 × 6 列；東西側緊湊直列）。
const MAX_SLOTS := 24

var _rivers := {}   # side("bottom"/"top"/"left"/"right") -> GridContainer
var _slots := {}    # side -> Array[TextureRect]


func _ready() -> void:
	_rivers = {
		"bottom": %RiverBottom,
		"top": %RiverTop,
		"left": %RiverLeft,
		"right": %RiverRight,
	}
	for side in _rivers:
		_slots[side] = []


## 單一側的池化槽位（存在則重用，否則建立 24 個 TextureRect）。
func slots_for_side(side: String) -> Array:
	if not _rivers.has(side):
		return []
	var slots: Array = _slots[side]
	if not slots.is_empty():
		return slots
	var river: GridContainer = _rivers[side]
	var sz := Vector2(32, 42)
	if side == "left" or side == "right":
		sz = Vector2(16, 22)  # 直列空間有限 → 縮小，避免打爆 layout。
	for i in range(MAX_SLOTS):
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
	_slots[side] = slots
	return slots


## panel 節點名 → 側名（seat→panel 是 table.gd 的座次映射）。
func side_for_panel(panel_name: String) -> String:
	match panel_name:
		"SouthPanel":
			return "bottom"
		"NorthPanel":
			return "top"
		"WestPanel":
			return "left"
		"EastPanel":
			return "right"
	return "bottom"


## 依 panel 節點名取該側槽位（fly/marker/highlight 定位用）。
func slots_for_panel(panel_name: String) -> Array:
	return slots_for_side(side_for_panel(panel_name))


## 全部側的槽位（供同款高亮掃描）。
func all_slots() -> Array:
	var out: Array = []
	for side in _slots:
		out.append_array(_slots[side])
	return out


## 依特定 tile_id 高亮相符棄牌槽位（空字串則全部回復原色）。
func highlight_matches(selected_tile_id: String) -> void:
	for tr: TextureRect in all_slots():
		if selected_tile_id != "" and tr.visible \
			and str(tr.get_meta("tile_id", "")) == selected_tile_id:
			tr.modulate = Color(1.3, 1.15, 0.7, 1.0)
		else:
			tr.modulate = Color(1.0, 1.0, 1.0, 1.0)


## 依「座次→河」對應與各家棄牌刷新畫面（超過 24 張只顯示最新 24 張）。
func refresh(seat_to_side: Dictionary, discards_by_seat: Array) -> void:
	for seat in range(4):
		var side: String = seat_to_side.get(seat, "bottom")
		var slots: Array = slots_for_side(side)
		var tiles: Array = discards_by_seat[seat] if seat < discards_by_seat.size() else []
		if tiles.size() > MAX_SLOTS:
			tiles = tiles.slice(tiles.size() - MAX_SLOTS)
		for i in range(MAX_SLOTS):
			var tr: TextureRect = slots[i]
			if i < tiles.size():
				var tile_id: String = str(tiles[i])
				TileLoader.apply_face(tr, tile_id)
				tr.visible = true
			else:
				tr.visible = false
				tr.modulate = Color(1.0, 1.0, 1.0, 1.0)


## 離開 playing 狀態時隱藏所有河槽位並重置染色（避免殘留畫面）。
func hide_all() -> void:
	for side in _slots:
		for tr: TextureRect in _slots[side]:
			tr.visible = false
			tr.modulate = Color(1.0, 1.0, 1.0, 1.0)