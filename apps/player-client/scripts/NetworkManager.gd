extends Node
## NetworkManager — WebSocket 通訊層 (Autoload 單例)
##
## 職責：
##   * 連線至權威伺服器 `apps/server` (WSS)。
##   * 斷線自動重連 + Ping/Pong 心跳（偵測半開連線）。
##   * 把 Server 事件派發給 GameState 與 UI（嚴禁在此做任何吃碰槓胡判斷）。
##   * 提供 create / join / ready / discard / reaction / pass / ping 指令。
##
## 對接 wire 協定（apps/server/src/protocol.ts）：
##   指令   : { type, operationId, generationId?, ... }
##   事件   : welcome / room.created / player.joined / player.ready /
##            player.left / game.started / game.ended / snapshot / error / pong

signal connected(protocol: String)
signal disconnected(code: int)
signal reconnect_attempt(attempt: int)
signal reconnect_failed
signal room_created(room_id: String)
signal player_joined(player_id: String, seat: int)
signal player_ready(seat: int)
signal player_left(seat: int)
signal game_started(dealer: int)
signal game_ended(payload: Dictionary)
signal snapshot_received(snapshot: Dictionary)
signal error_received(code: String, message: String, operation_id: String)
signal pong_received(latency_ms: int)

const DEFAULT_URL := "wss://taiwan-mahjong-server-production.up.railway.app/ws"
const PROTOCOL_VERSION := "1.0.0"

## 連線參數
var url: String = DEFAULT_URL
var player_name := "Player"
var player_id := ""
var room_id := ""
## 只有 ready_state == STATE_OPEN 才算已連線（連線中 CONNECTING 不算）。
var is_connected := false

## 自動重連
var auto_reconnect := true
var reconnect_delay := 2.0
var max_reconnect_attempts := 30

## 心跳（Ping/Pong）
var ping_interval := 5.0
var ping_timeout := 10.0

## 連線狀態機（內部）：DISCONNECTED → CONNECTING → OPEN。
enum ConnState { DISCONNECTED, CONNECTING, OPEN }

var socket: WebSocketPeer
var _conn_state: int = ConnState.DISCONNECTED
var _reconnect_attempts := 0
var _reconnect_timer: Timer
var _ping_timer: Timer
## 最近一次送出 ping 的時刻（epoch ms）；0 表示未在等待 pong。
var _ping_sent_at := 0
## 是否已送出 ping 且尚未收到 pong（半開連線偵測用）。
var _ping_awaiting := false
var _last_pong_ms := 0
var _op_counter := 0
## 重連自動重新加入（P0-3）：斷線時保存先前身份，socket 重開後自動補送 join。
var _pending_rejoin := false
var _rejoin_room_id := ""
var _rejoin_player_id := ""
## 座位憑證（seat credential）— 伺服器開啟 SEAT_CREDENTIAL_SECRET 時，
## 首次 join 會發行綁定「房間+座位+玩家」的 HMAC 憑證；重連必須帶上它
## 才能恢復座位（防止假冒他人 playerId 佔位）。
var seat_credential := ""

func _ready() -> void:
	# HTML5（網頁版）：預設連到「頁面所在的主機」— 由 serve:web 同源掛載 WSS，
	# 讓瀏覽器版開箱即用（不必手改 URL）。
	if OS.has_feature("web") and url == DEFAULT_URL:
		var host: String = JavaScriptBridge.eval("window.location.host", true)
		if host != "":
			var proto: String = JavaScriptBridge.eval("window.location.protocol", true)
			var ws_scheme: String = "wss" if proto == "https:" else "ws"
			url = "%s://%s/ws" % [ws_scheme, host]

	_reconnect_timer = Timer.new()
	_reconnect_timer.one_shot = true
	_reconnect_timer.timeout.connect(_try_reconnect)
	add_child(_reconnect_timer)

	_ping_timer = Timer.new()
	_ping_timer.wait_time = ping_interval
	_ping_timer.timeout.connect(ping_now)
	add_child(_ping_timer)
	_ping_timer.stop()


func _process(_delta: float) -> void:
	if socket == null:
		return
	socket.poll()
	var state: int = socket.get_ready_state()
	match state:
		WebSocketPeer.STATE_OPEN:
			# 連線第一次進入 OPEN：把狀態機推進到 OPEN，啟動心跳。
			if _conn_state == ConnState.CONNECTING:
				_conn_state = ConnState.OPEN
				is_connected = true
				_ping_awaiting = false
				_ping_sent_at = 0
				_ping_timer.start(ping_interval)
			# 重連成功：自動重新加入房間（帶先前 playerId/roomId），
			# 讓伺服器恢復座位並重送 Snapshot。必須在處理 welcome 之前送出，
			# 否則 welcome 會用新的 playerId 覆寫 _rejoin_room_id / _rejoin_player_id。
			if _pending_rejoin:
				_pending_rejoin = false
				if _rejoin_room_id != "" and _rejoin_player_id != "":
					join_room(_rejoin_room_id, _rejoin_player_id)
			while socket.get_available_packet_count() > 0:
				var text: String = socket.get_packet().get_string_from_utf8()
				_handle_message(text)
			# 半開連線偵測：送出 ping 後逾時未收到 pong → 視為斷線。
			if _ping_awaiting and _ping_sent_at > 0 \
				and (Time.get_ticks_msec() - _ping_sent_at) > int(ping_timeout * 1000.0):
				_handle_half_open_timeout()
		WebSocketPeer.STATE_CLOSING:
			pass
		WebSocketPeer.STATE_CLOSED:
			if _conn_state == ConnState.OPEN and is_connected:
				_handle_disconnect(socket.get_close_code())
			elif _conn_state == ConnState.CONNECTING:
				# 連線尚未成功即關閉（連線失敗）：直接進入重連。
				_conn_state = ConnState.DISCONNECTED
				is_connected = false
				_ping_timer.stop()
				disconnected.emit(socket.get_close_code())
				if auto_reconnect:
					_start_reconnect_timer()


# ---------------------------------------------------------------------------
# 連線 / 重連
# ---------------------------------------------------------------------------

## 連線到指定伺服器（預設 ws://localhost:3000/ws）。
func connect_to_server(target_url: String = "") -> void:
	if target_url != "":
		url = target_url
	if socket != null and socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		return
	socket = WebSocketPeer.new()
	_conn_state = ConnState.CONNECTING
	is_connected = false
	_ping_awaiting = false
	_ping_sent_at = 0
	_reconnect_attempts = 0
	var err: Error = socket.connect_to_url(url)
	if err != OK:
		push_error("NetworkManager: 連線失敗 %s (%d)" % [url, err])
		_conn_state = ConnState.DISCONNECTED
		if auto_reconnect:
			_start_reconnect_timer()
		return


func disconnect_from_server() -> void:
	auto_reconnect = false
	_reconnect_timer.stop()
	_ping_timer.stop()
	# 主動離開：清除重連身份，避免之後誤自動重新加入。
	_pending_rejoin = false
	_rejoin_room_id = ""
	_rejoin_player_id = ""
	seat_credential = ""
	if socket != null:
		socket.close(1000, "client leaving")
		socket = null
	_conn_state = ConnState.DISCONNECTED
	is_connected = false
	_ping_awaiting = false
	_ping_sent_at = 0


func _handle_disconnect(code: int) -> void:
	# 斷線時先保存先前身份（welcome 抵達時會覆寫 player_id / room_id）。
	_rejoin_room_id = room_id
	_rejoin_player_id = player_id
	_pending_rejoin = _rejoin_room_id != "" and _rejoin_player_id != ""
	_conn_state = ConnState.DISCONNECTED
	is_connected = false
	_ping_awaiting = false
	_ping_sent_at = 0
	_ping_timer.stop()
	disconnected.emit(code)
	if auto_reconnect:
		_start_reconnect_timer()


## 半開連線：ping 已送出但逾時未收到 pong。主動關閉 socket 並視為斷線，
## 讓既有重連流程接手（保存 rejoin 身份 → 重連 → welcome 前補送 join）。
func _handle_half_open_timeout() -> void:
	push_warning("NetworkManager: ping 逾時，判定半開連線，觸發重連")
	_ping_awaiting = false
	_ping_sent_at = 0
	if socket != null:
		socket.close(1001, "ping timeout")
	_handle_disconnect(1001)


func _start_reconnect_timer() -> void:
	if _reconnect_attempts >= max_reconnect_attempts:
		reconnect_failed.emit()
		return
	_reconnect_attempts += 1
	reconnect_attempt.emit(_reconnect_attempts)
	_reconnect_timer.start(reconnect_delay)


func _try_reconnect() -> void:
	if is_connected or _conn_state == ConnState.CONNECTING:
		return
	connect_to_server(url)


# ---------------------------------------------------------------------------
# 心跳
# ---------------------------------------------------------------------------

## 送出 ping（帶時間戳，伺服器回 pong 以量測延遲）。若上一筆 ping 尚未收到
## pong（半開連線），不再疊加送出，交由 _process 逾時偵測處理。
func ping_now() -> void:
	if socket == null or socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	if _ping_awaiting:
		return
	_ping_awaiting = true
	_ping_sent_at = Time.get_ticks_msec()
	send_command("ping", {"t": _ping_sent_at})


func _handle_pong(t: int) -> void:
	_ping_awaiting = false
	_ping_sent_at = 0
	_last_pong_ms = Time.get_ticks_msec() - t
	pong_received.emit(_last_pong_ms)
	# 每次 pong 重置心跳計時（逾時即視為斷線）。
	_ping_timer.start(ping_interval)


# ---------------------------------------------------------------------------
# 事件派發
# ---------------------------------------------------------------------------

func _handle_message(text: String) -> void:
	var data: Variant = JSON.parse_string(text)
	if not data is Dictionary:
		push_warning("NetworkManager: 收到非物件 JSON")
		return
	var event: Dictionary = data
	var type: String = event.get("type", "")
	match type:
		"welcome":
			player_id = event.get("playerId", "")
			room_id = event.get("roomId", "") if event.get("roomId") != null else ""
			if event.get("seatCredential") != null:
				seat_credential = str(event.get("seatCredential", ""))
			connected.emit(event.get("protocol", ""))
		"room.created":
			room_id = event.get("roomId", "")
			room_created.emit(room_id)
		"player.joined":
			if event.get("seatCredential") != null:
				seat_credential = str(event.get("seatCredential", ""))
			player_joined.emit(event.get("playerId", ""), event.get("seat", -1))
		"player.ready":
			player_ready.emit(event.get("seat", -1))
		"player.left":
			player_left.emit(event.get("seat", -1))
		"game.started":
			_ping_timer.start(ping_interval)
			game_started.emit(event.get("dealer", -1))
		"game.ended":
			_ping_timer.stop()
			game_ended.emit(event)
		"snapshot":
			GameState.apply_snapshot(event.get("snapshot", {}))
			snapshot_received.emit(event.get("snapshot", {}))
		"error":
			error_received.emit(
				event.get("code", ""),
				event.get("message", ""),
				event.get("operationId", ""),
			)
		"pong":
			_handle_pong(event.get("t", 0))
		_:
			push_warning("NetworkManager: 未知事件類型 %s" % type)


# ---------------------------------------------------------------------------
# 指令（對應 server protocol.ts）
# ---------------------------------------------------------------------------

## 送出任意指令並自動產生唯一 operationId（冪等金鑰）。
func send_command(type: String, payload: Dictionary = {}, with_generation: bool = false) -> void:
	if socket == null or socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		push_warning("NetworkManager: 未連線，指令 %s 被忽略" % type)
		return
	_op_counter += 1
	var cmd: Dictionary = {
		"type": type,
		"operationId": "op-%d-%d" % [_op_counter, Time.get_ticks_usec()],
	}
	if with_generation:
		cmd["generationId"] = GameState.generation_id
	for key in payload:
		cmd[key] = payload[key]
	socket.send_text(JSON.stringify(cmd))


func create_room() -> void:
	send_command("create", {"playerName": player_name})


## 加入房間。傳入先前的 player_id 可重連（伺服器恢復座位，含遊戲中）。
## 若已持有座位憑證（首次 join 發行），重連時一併送出以通過驗證。
func join_room(target_room_id: String, previous_player_id: String = "") -> void:
	var payload: Dictionary = {"roomId": target_room_id, "playerName": player_name}
	if previous_player_id != "":
		payload["playerId"] = previous_player_id
		if seat_credential != "":
			payload["seatCredential"] = seat_credential
	send_command("join", payload)


## 準備 — 注意：不能用 "ready" 當函式名（會與 Node 內建訊號 ready 衝突）。
func mark_ready() -> void:
	send_command("ready")


## 出牌 — 使用 Snapshot 中手牌的 instanceId。
func discard(tile_instance_id: int) -> void:
	send_command("discard", {"tileInstanceId": tile_instance_id}, true)


## 反應 — kind: "chi" | "peng" | "kong"；hand_tile_ids 為對應手牌 instanceId。
func react(kind: String, hand_tile_ids: Array = [], extra: Dictionary = {}) -> void:
	var payload: Dictionary = {"kind": kind}
	if not hand_tile_ids.is_empty():
		payload["handTileIds"] = hand_tile_ids
	for key in extra:
		payload[key] = extra[key]
	send_command("reaction", payload, true)


func pass_reaction() -> void:
	send_command("pass", {}, true)
