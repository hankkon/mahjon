extends Button
## TileButton — 可點擊的單張手牌按鈕（Client-Safe UI）。
##
## 由 Table 視圖動態實體化；持有 instanceId（伺服器手牌唯一 ID）。
## 點擊時若「輪到自己出牌」，送出 Discard Command（含 generationId）。
##
## 牌面渲染（貼圖版）：
##   * 牌面 / 牌背皆用麻將 PNG 貼圖（TileLoader 統一載入，絕不出現純文字）。
##   * 節點結構：Button(48x64) > Back(TextureRect) + Face(TextureRect)。
##   * Hover / 選中：position.y 上浮 -HOVER_LIFT（20px），scale 恆為 1.0，
##     圖片不會變形、縮小或被裁切。
##   * 點擊選中：金色強調框 + 同步上浮（兩段式：第一次選中、第二次出牌）。
##   * 胡牌光暈：canWin（聽牌）時金色脈動光暈。
##   * 算牌高亮：被 Table 標記為「棄牌池同款」時暖金強調框。

signal tile_clicked(instance_id: int)
## 第二次點擊（已選中）時送出：Table 記錄出牌起點並清除選中，再由本按鈕送 Discard。
signal tile_discarded(instance_id: int)

## Hover / 選中動畫參數（僅上浮；Scale 恆 = 1.0，嚴禁縮小/變形/裁切）。
const HOVER_LIFT := 20.0
const HOVER_DURATION := 0.12

## 強調框色票（貼圖外框）。
const GOLD_BORDER := Color("#D4AF37")
const GOLD_BORDER_SOFT := Color(0.83, 0.69, 0.22, 0.8)

var instance_id := -1
var tile_id := ""
## 是否為自己手牌中的可出牌張（由 Table 依 turn/phase 設定）。
var playable := false
## 是否為「棄牌池同款」高亮（算牌）。
var discard_match := false

var _selected := false
var _win_glow := false
var _hovered := false
var _base_pos := Vector2.ZERO
## 上浮前快照的版面位置（HBox 配置出的實際位置）。
var _rest_pos := Vector2.ZERO
## 目前是否處於上浮狀態（Hover 或 選中）。
var _lifted := false
## 手牌重排動畫期間暫停上浮（避免與版面滑動 Tween 衝突）。
var _suppress_lift := false
var _scale_tween: Tween
var _pulse_tween: Tween

@onready var face_rect: TextureRect = $Face
@onready var back_rect: TextureRect = $Back


func setup(tile_instance_id: int, id: String, can_play: bool) -> void:
	instance_id = tile_instance_id
	tile_id = id
	playable = can_play
	tooltip_text = id
	_refresh_appearance()


func _ready() -> void:
	_apply_textures()
	pressed.connect(_on_pressed)
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	gui_input.connect(_on_gui_input)
	# 加入場景樹後再刷一次（setup() 可能在進入樹前就被呼叫，@onready 尚未就緒）。
	_refresh_appearance()


func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		if not disabled:
			_on_pressed()


func _exit_tree() -> void:
	if _scale_tween and _scale_tween.is_valid():
		_scale_tween.kill()
		_scale_tween = null
	if _pulse_tween and _pulse_tween.is_valid():
		_pulse_tween.kill()
		_pulse_tween = null



## 載入牌面 / 牌背貼圖（統一走 TileLoader，絕不出現純文字）。
func _apply_textures() -> void:
	if face_rect == null or back_rect == null:
		return
	face_rect.texture = TileLoader.face_texture(tile_id)
	back_rect.texture = TileLoader.back_texture()
	# 手牌預設顯示牌面（牌背節點保留，供未來/除錯切換）。
	face_rect.visible = true
	back_rect.visible = false


## 由 Table 在「未重建按鈕」時更新可出牌狀態（含 disabled + 外觀）。
func apply_playability(can_play: bool) -> void:
	playable = can_play
	disabled = not can_play
	_refresh_appearance()


## 點擊選中（金色強調框）。
func set_selected(sel: bool) -> void:
	_selected = sel
	_refresh_appearance()


## 胡牌光暈（金色邊框 + 脈動）。
func set_win_glow(glow: bool) -> void:
	_win_glow = glow
	_refresh_appearance()


## 算牌高亮（棄牌池同款 → 暖金強調框）。
func set_discard_match(match: bool) -> void:
	discard_match = match
	_refresh_appearance()


func _on_pressed() -> void:
	# 動畫播放期間鎖定輸入（Majsoul 風格：動畫中不可出牌/選牌）。
	if AnimationQueue.is_playing():
		return
	AudioManager.play_button()
	# 出牌權由伺服器把關；這裡只送指令，不判斷合法性。
	if not GameState.is_my_discard_turn() or instance_id < 0:
		return
	if _selected:
		# 第二次點擊（已選中）→ 送出棄牌。先通知 Table 記錄起點/清除選中，
		# 再送 NetworkManager.discard。
		tile_discarded.emit(instance_id)
		NetworkManager.discard(instance_id)
	else:
		# 第一次點擊 → 選中（抬升 + 金色外框 + 同款高亮由 Table 統一驅動）。
		tile_clicked.emit(instance_id)


func _on_mouse_entered() -> void:
	_hovered = true
	_refresh_appearance()


func _on_mouse_exited() -> void:
	_hovered = false
	_refresh_appearance()


## 是否應「向上浮起」：Hover 或 點擊選中 皆成立（且可出牌時才能 Hover 上浮）。
func _should_lift() -> bool:
	return (_hovered and playable and not disabled) or _selected


## 上浮動畫核心（僅位移，不縮放）：
##   * 浮起：position.y -HOVER_LIFT、scale = 1.0
##   * 復原：position.y 回到 _rest_pos、scale = Vector2.ONE
## 由 _refresh_appearance() 統一驅動，Hover 與選中共用同一套邏輯。
func _sync_lift() -> void:
	if _suppress_lift:
		return
	var want_lift := _should_lift()
	if want_lift == _lifted:
		return
	_lifted = want_lift
	if _scale_tween and _scale_tween.is_valid():
		_scale_tween.kill()
	_scale_tween = create_tween()
	_scale_tween.set_parallel(true)
	if want_lift:
		# 快照目前版面位置，避免 HBox 重排後基準錯位。
		_rest_pos = position
		var target_pos: Vector2 = _rest_pos + Vector2(0, -HOVER_LIFT)
		_scale_tween.tween_property(self, "position", target_pos, HOVER_DURATION) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	else:
		_scale_tween.tween_property(self, "position", _rest_pos, HOVER_DURATION) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


## 重排動畫期間暫停 / 恢復上浮（Table 平滑理牌時呼叫）。
func set_suppress_lift(suppress: bool) -> void:
	_suppress_lift = suppress
	if not suppress:
		_sync_lift()


## 記錄基準位置（供 Hover 上浮還原）— 由 Table 在加入後呼叫。
func set_base_position(pos: Vector2) -> void:
	_base_pos = pos
	_rest_pos = pos
	position = pos
	scale = Vector2.ONE
	_lifted = false


## 記錄基準位置（HBox 版面變動後由 Table 重設）。
func reset_base_position() -> void:
	_base_pos = position
	_rest_pos = position


func _refresh_appearance() -> void:
	# 鎖定（動畫播放中）或不可出牌時淡化。
	var alpha: float = 0.85 if (disabled or not playable) else 1.0
	if _win_glow:
		_apply_tile_style(GOLD_BORDER, 3)
		modulate = Color(1.3, 1.2, 0.85, alpha)
		_start_win_pulse()
	elif _selected:
		# 選中：明顯金色外框（Majsoul 風格兩段式出牌的第一段）。
		_apply_tile_style(GOLD_BORDER, 3)
		modulate = Color(1.15, 1.12, 0.95, alpha)
		_stop_win_pulse()
	elif discard_match:
		# 算牌：暖金強調框。
		_apply_tile_style(GOLD_BORDER_SOFT, 2)
		modulate = Color(1.15, 1.12, 0.95, alpha)
		_stop_win_pulse()
	elif _hovered and playable and not disabled:
		_apply_tile_style(GOLD_BORDER_SOFT, 2)
		modulate = Color(1.08, 1.05, 0.95, alpha)
		_stop_win_pulse()
	else:
		_apply_tile_style(Color(0, 0, 0, 0), 0)
		modulate = Color(1.0, 1.0, 1.0, alpha)
		_stop_win_pulse()
	# Hover lift without scaling (Majsoul style): position.y only, scale fixed at 1.0.
	if scale != Vector2.ONE:
		scale = Vector2.ONE
	# 依 Hover / 選中 狀態同步上浮動畫。
	_sync_lift()


## 在貼圖外圍套上強調框（背景透明，貼圖完整透出，不遮蓋、不裁切）。
func _apply_tile_style(border: Color, width: int) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0)
	sb.border_color = border
	sb.border_width_left = width
	sb.border_width_right = width
	sb.border_width_top = width
	sb.border_width_bottom = width
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	add_theme_stylebox_override("normal", sb)
	add_theme_stylebox_override("hover", sb)
	add_theme_stylebox_override("pressed", sb)
	add_theme_stylebox_override("focus", sb)


## 聽牌光暈：金色邊框輕微脈動（Tween loop）。
func _start_win_pulse() -> void:
	if _pulse_tween and _pulse_tween.is_valid():
		return
	_pulse_tween = create_tween().set_loops()
	_pulse_tween.tween_property(self, "modulate", Color(1.5, 1.3, 0.9, modulate.a), 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_pulse_tween.tween_property(self, "modulate", Color(1.2, 1.1, 0.8, modulate.a), 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _stop_win_pulse() -> void:
	if _pulse_tween and _pulse_tween.is_valid():
		_pulse_tween.kill()
		_pulse_tween = null
