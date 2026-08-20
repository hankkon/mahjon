extends RefCounted

## HandView — 手牌視圖邏輯與按鈕渲染器 (UI View Component)
## 負責管理手牌容器 (hand_area) 中的 TileButton 建立、自動理牌、24px 摸牌間隔器、
## 輸入鎖定/解鎖與手牌平滑重排動畫。

const HandUtils := preload("res://scripts/ui/hand_utils.gd")

signal tile_clicked(instance_id: int)
signal tile_discard_requested(instance_id: int)

var hand_area: Control
var hand_label: Label
var tile_btn_scene: PackedScene
var table_ref: Object
var _last_gen_id: int = -1


func _init(area: Control, label: Label, scene: PackedScene, table: Object) -> void:
	hand_area = area
	hand_label = label
	tile_btn_scene = scene
	table_ref = table


func _get_last_hand() -> Array:
	if table_ref and "_last_hand" in table_ref:
		return table_ref._last_hand
	return []


func _set_last_hand(hand: Array) -> void:
	if table_ref and "_last_hand" in table_ref:
		table_ref._last_hand = hand.duplicate()


func set_selection(instance_id: int) -> void:
	if table_ref and "_selected_instance_id" in table_ref:
		table_ref._selected_instance_id = instance_id
	for child in hand_area.get_children():
		if child is Button and child.has_method("set_tile_selected"):
			var is_sel: bool = ("instance_id" in child and int(child.instance_id) == instance_id)
			child.set_tile_selected(is_sel)


func hv_sorted_hand(hand: Array) -> Array:
	return HandUtils.sorted_hand(hand)


func hv_hand_equals(hand: Array) -> bool:
	return HandUtils.hand_equals(hand, _get_last_hand())


func hv_order_equals(hand: Array) -> bool:
	return HandUtils.order_equals(hand, _get_last_hand())


func render_hand(game_state: Object, anim_queue_playing: bool) -> void:
	# 局數/世代演進 (generationId) 變化時，立即重置歷史手牌，防止上一局手牌 instanceId 混淆。
	var current_gen: int = game_state.generation_id if "generation_id" in game_state else -1
	if _last_gen_id != current_gen or game_state.status != "playing":
		_last_gen_id = current_gen
		_set_last_hand([])

	var full_hand: Array = hv_sorted_hand(game_state.my_hand())
	if hand_label:
		hand_label.text = "我的手牌（%d 張）" % full_hand.size()
	var split := hv_split_drawn_tile(full_hand, game_state)
	var hand: Array = split[0]
	var drawn: Variant = split[1]
	var can_play: bool = game_state.is_my_discard_turn() \
		and not game_state.is_autoplay(game_state.you) and not anim_queue_playing

	var lh: Array = _get_last_hand()
	if hv_hand_equals(full_hand):
		if not hv_order_equals(full_hand):
			hv_animate_hand_reflow(hand, can_play)
		else:
			hv_apply_playability_all(can_play)
		hv_render_draw_spacer(drawn, can_play)
		_set_last_hand(full_hand)
		return

	if lh.is_empty():
		hv_rebuild_hand_sync(hand, can_play)
	else:
		hv_animate_hand_reflow(hand, can_play)
	hv_render_draw_spacer(drawn, can_play)
	_set_last_hand(full_hand)


func hv_resolve_newly_added_tile(hand: Array, game_state: Object) -> Variant:
	if hand.is_empty():
		return null
	var newest: Variant = null
	if game_state.last_drawn_by == game_state.you and not game_state.last_drawn_tile.is_empty():
		var wanted := int(game_state.last_drawn_tile.get("instanceId", -1))
		for t in hand:
			if int(t.get("instanceId", -1)) == wanted:
				newest = t
				break
	var lh: Array = _get_last_hand()
	if newest == null and not lh.is_empty():
		var prev_ids := {}
		for t in lh:
			prev_ids[int(t.get("instanceId", -1))] = true
		var candidates: Array = []
		for t in hand:
			if not prev_ids.has(int(t.get("instanceId", -1))):
				candidates.append(t)
		if candidates.size() >= 1:
			newest = candidates[0]
	if newest == null:
		newest = hand[hand.size() - 1]
	return newest


func hv_split_drawn_tile(hand: Array, game_state: Object) -> Array:
	if hand.size() != 17 or not game_state.is_my_discard_turn():
		return [hand, null]
	var newest: Variant = hv_resolve_newly_added_tile(hand, game_state)
	var base: Array = hand.duplicate()
	base.erase(newest)
	return [base, newest]


func hv_render_draw_spacer(drawn: Variant, can_play: bool) -> void:
	# 先使用 remove_child 立即將舊間隔器與舊摸牌按鈕從容器節點樹移除，
	# 再呼叫 queue_free，防止同幀內 queue_free 未生效導致間隔器重複累積拉大間距。
	for child in hand_area.get_children():
		if child is Control and child.has_meta("draw_spacer"):
			hand_area.remove_child(child)
			child.queue_free()
		elif child is Button and child.has_meta("is_drawn_tile"):
			hand_area.remove_child(child)
			child.queue_free()
	if drawn == null:
		return
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(24, 0)
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.set_meta("draw_spacer", true)
	hand_area.add_child(spacer)
	var btn: Button = hv_create_tile_button(drawn, can_play)
	btn.set_meta("is_drawn_tile", true)
	hand_area.add_child(btn)


func hv_create_tile_button(t: Dictionary, can_play: bool) -> Button:
	if table_ref and table_ref.has_method("_create_tile_button"):
		return table_ref.call("_create_tile_button", t, can_play)
	var btn: Button = tile_btn_scene.instantiate()
	btn.setup(int(t.get("instanceId", -1)), str(t.get("id", "")), can_play)
	btn.disabled = not can_play
	return btn


func hv_rebuild_hand_sync(hand: Array, can_play: bool) -> void:
	# remove_child 立即清空舊節點，防止重複累積舊元件
	for child in hand_area.get_children():
		hand_area.remove_child(child)
		child.queue_free()
	for t in hand:
		hand_area.add_child(hv_create_tile_button(t, can_play))


func hv_apply_playability_all(can_play: bool) -> void:
	for child in hand_area.get_children():
		if child is Button:
			if child.has_method("apply_playability"):
				child.apply_playability(can_play)
				if table_ref and table_ref.has_method("_apply_tile_extras"):
					table_ref.call("_apply_tile_extras", child)
			else:
				child.modulate.a = 1.0 if can_play else 0.85
				child.disabled = not can_play


func hv_animate_hand_reflow(hand: Array, can_play: bool) -> void:
	var from_pos := {}
	var old_buttons := {}
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child:
			from_pos[child.instance_id] = child.global_position
			old_buttons[child.instance_id] = child

	var keep_ids := {}
	for t in hand:
		keep_ids[int(t.get("instanceId", -1))] = true

	for iid in old_buttons.keys():
		var btn: Button = old_buttons[iid]
		if not keep_ids.has(iid) and not btn.has_meta("is_drawn_tile"):
			var tw := btn.create_tween()
			tw.tween_property(btn, "modulate:a", 0.0, 0.12)
			tw.tween_callback(func():
				if btn.get_parent() == hand_area:
					hand_area.remove_child(btn)
				btn.queue_free()
			)

	hv_rebuild_hand_sync(hand, can_play)

	var tree = hand_area.get_tree()
	if tree:
		await tree.process_frame
	if not hand_area.is_inside_tree():
		return

	for child in hand_area.get_children():
		if not (child is Button and "instance_id" in child):
			continue
		var iid: int = child.instance_id
		if from_pos.has(iid):
			var old_p: Vector2 = from_pos[iid]
			var new_p: Vector2 = child.global_position
			if old_p.distance_to(new_p) > 2.0:
				var diff: Vector2 = old_p - new_p
				child.position += diff
				var tw := child.create_tween()
				tw.tween_property(child, "position", child.position - diff, 0.22) \
					.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		else:
			child.modulate.a = 0.0
			var tw := child.create_tween()
			tw.tween_property(child, "modulate:a", 1.0, 0.18)
