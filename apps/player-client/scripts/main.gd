extends Control
## Main — 連線 / 開房 / 加入選單。

@onready var url_edit: LineEdit = %UrlEdit
@onready var name_edit: LineEdit = %NameEdit
@onready var room_edit: LineEdit = %RoomEdit
@onready var status_label: Label = %StatusLabel
@onready var reconnect_label: Label = %ReconnectLabel

func _ready() -> void:
	%CreateBtn.pressed.connect(_on_create_pressed)
	%JoinBtn.pressed.connect(_on_join_pressed)
	if has_node("%QuickMatchBtn"):
		%QuickMatchBtn.pressed.connect(_on_quick_match_pressed)
	if has_node("%AIPracticeBtn"):
		%AIPracticeBtn.pressed.connect(_on_ai_practice_pressed)
	if has_node("%VerifyBtn"):
		%VerifyBtn.pressed.connect(_on_verify_pressed)
	if name_edit:
		name_edit.text_submitted.connect(func(_text: String): _apply_prefs())
	if room_edit:
		room_edit.text_submitted.connect(func(_text: String): _on_join_pressed())

	# 讀取上次使用的名稱（本地儲存）。
	if FileAccess.file_exists("user://player_name.cfg"):
		var f := FileAccess.open("user://player_name.cfg", FileAccess.READ)
		if f:
			name_edit.text = f.get_as_text().strip_edges()

	NetworkManager.connected.connect(_on_connected)
	NetworkManager.disconnected.connect(_on_disconnected)
	NetworkManager.reconnect_attempt.connect(_on_reconnect_attempt)
	NetworkManager.reconnect_failed.connect(_on_reconnect_failed)
	NetworkManager.room_created.connect(_on_room_created)
	NetworkManager.player_joined.connect(_on_player_joined)
	NetworkManager.game_started.connect(_on_game_started)
	NetworkManager.snapshot_received.connect(_on_snapshot)
	NetworkManager.error_received.connect(_on_error)
	NetworkManager.pong_received.connect(_on_pong)

	# 進入畫面即自動連線。
	# 網頁版由 NetworkManager._ready() 自動偵測同源主機（serve:web）並指向 3002，
	# 這裡不要覆蓋，否則會連到預設的 3000（舊伺服器、無 AI 補位）。桌面版才用輸入框的 URL。
	if not OS.has_feature("web"):
		NetworkManager.url = url_edit.text
	NetworkManager.player_name = name_edit.text if name_edit.text != "" else "Player"
	NetworkManager.connect_to_server()


func _on_quick_match_pressed() -> void:
	_apply_prefs()
	status_label.text = "快速匹配中…（AI 智能即時補位）"
	NetworkManager.create_room()


func _on_ai_practice_pressed() -> void:
	_apply_prefs()
	status_label.text = "正在進入 AI 雀術修煉場…"
	NetworkManager.create_room()


func _on_verify_pressed() -> void:
	var verify_url: String = "http://localhost:3000/verify"
	if OS.has_feature("web"):
		verify_url = "/verify"
	OS.shell_open(verify_url)


func _on_create_pressed() -> void:
	_apply_prefs()
	NetworkManager.create_room()


func _on_join_pressed() -> void:
	_apply_prefs()
	var room_id := room_edit.text.strip_edges()
	if room_id == "":
		status_label.text = "請輸入房間代碼"
		return
	# 重連：若本地已有 playerId 則帶上（伺服器恢復座位）。
	var previous := NetworkManager.player_id
	NetworkManager.join_room(room_id, previous)


func _apply_prefs() -> void:
	# 網頁版維持自動偵測的 URL（同源 3002），不覆蓋。
	if not OS.has_feature("web"):
		NetworkManager.url = url_edit.text.strip_edges()
	NetworkManager.player_name = name_edit.text.strip_edges()
	if NetworkManager.player_name == "":
		NetworkManager.player_name = "Player"
	var f := FileAccess.open("user://player_name.cfg", FileAccess.WRITE)
	if f:
		f.store_string(NetworkManager.player_name)


# ---------------------------------------------------------------------------
# NetworkManager 訊號處理
# ---------------------------------------------------------------------------

func _on_connected(protocol: String) -> void:
	status_label.text = "已連線 (protocol %s)" % protocol
	reconnect_label.visible = false


func _on_disconnected(code: int) -> void:
	status_label.text = "已斷線 (code %d) — 自動重連中…" % code
	reconnect_label.text = "重連中…"
	reconnect_label.visible = true


func _on_reconnect_attempt(attempt: int) -> void:
	reconnect_label.text = "重連嘗試 %d/%d…" % [attempt, NetworkManager.max_reconnect_attempts]


func _on_reconnect_failed() -> void:
	reconnect_label.text = "重連失敗 — 請確認 apps/server 已啟動"
	status_label.text = "未連線"


func _on_room_created(room_id: String) -> void:
	status_label.text = "已開房：%s （準備中…）" % room_id
	NetworkManager.mark_ready()


func _on_player_joined(player_id: String, seat: int) -> void:
	status_label.text = "%s 已入座（座位 %d）" % [player_id.substr(0, 8), seat]


func _on_game_started(_dealer: int) -> void:
	_enter_table()


## 收到快照：已加入房間（lobby）就切到牌桌大廳，才能按「準備 (Ready)」。
func _on_snapshot(_snapshot: Dictionary) -> void:
	if GameState.status == "lobby" and GameState.room_id != "":
		_enter_table()


## 切換到牌桌場景（若已在大廳則不重複切換）。
func _enter_table() -> void:
	# 快照可能在場景樹尚未就緒、或本節點已被移出樹（競態）時到達，
	# 此時 get_tree() 內部會讀到 null 而炸。用 is_inside_tree() 判斷最安全。
	if not is_inside_tree():
		return
	var tree := get_tree()
	var current := tree.current_scene
	if current != null and current.name == "Table":
		return
	tree.change_scene_to_file("res://scenes/Table.tscn")


func _on_error(code: String, message: String, _operation_id: String) -> void:
	status_label.text = "錯誤 [%s] %s" % [code, message]


func _on_pong(latency_ms: int) -> void:
	status_label.text = "已連線 — 延遲 %d ms" % latency_ms
