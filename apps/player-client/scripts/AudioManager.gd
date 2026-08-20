extends Node
## AudioManager — 全域音效管理 (Autoload 單例)
##
## 功能：
##   1. 獨立音量控制（主音量 / 音效 / 語音）與靜音開關，
##      設定自動儲存於 `user://audio_settings.json`。
##   2. 雙軌音效載入：
##      * 若 `res://audio/` 有實體 `.wav` / `.ogg` 音效檔，優先載入；
##      * 否則以 GDScript 程式化生成基礎音效（Pop / Click / Tick），
##        確保無音效資源時不報錯、不 crash。
##   3. 與 table.gd 整合：摸牌滑入、棄牌落桌、吃/碰/槓/胡、結算面板
##      自動播放對應音效。
##
## 使用：
##   AudioManager.play_discard()
##   AudioManager.play_draw()
##   AudioManager.play_meld("peng")
##   AudioManager.set_bus_volume("sfx", 0.8)

# --- 音效名稱 → 檔案路徑（若實體檔存在則載入，否則用程式化音效） ---
const SFX_FILES := {
	"discard": "res://audio/discard_pop.wav",
	"draw": "res://audio/draw_click.wav",
	"button": "res://audio/button_tick.wav",
	"chi": "res://audio/chi.wav",
	"peng": "res://audio/peng.wav",
	"kong": "res://audio/kong.wav",
	"win": "res://audio/win.wav",
	"settle": "res://audio/settle.wav",
	"turn": "res://audio/turn_start.wav",
	"alert": "res://audio/countdown_alert.wav",
}

const SETTINGS_PATH := "user://audio_settings.json"

const BUS_MASTER := "Master"
const BUS_SFX := "SFX"
const BUS_VOICE := "Voice"

# 音量範圍（線性 0.0~1.0 → dB）
const MIN_DB := -60.0
const MAX_DB := 0.0

# --- 音量狀態（0.0~1.0） ---
var master_volume := 1.0
var sfx_volume := 1.0
var voice_volume := 1.0
var muted := false

# 已載入的音效流：{ name: AudioStream }
var _streams: Dictionary = {}
# 音效播放器池（避免每播一次 new 一個）。
var _sfx_pool: Array[AudioStreamPlayer] = []
var _pool_index := 0

var _voice_player: AudioStreamPlayer


func _ready() -> void:
	_setup_buses()
	_load_settings()
	_load_streams()
	_create_pool()


# ---------------------------------------------------------------------------
# 匯流排設定（主 / 音效 / 語音）
# ---------------------------------------------------------------------------

func _setup_buses() -> void:
	for bus_name in [BUS_SFX, BUS_VOICE]:
		if AudioServer.get_bus_index(bus_name) == -1:
			AudioServer.add_bus()
			AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)
			AudioServer.set_bus_send(AudioServer.bus_count - 1, BUS_MASTER)


# ---------------------------------------------------------------------------
# 設定持久化（user://audio_settings.json）
# ---------------------------------------------------------------------------

func _load_settings() -> void:
	if not FileAccess.file_exists(SETTINGS_PATH):
		_apply_volumes()
		return
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if f == null:
		_apply_volumes()
		return
	var text: String = f.get_as_text()
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		var d: Dictionary = parsed
		master_volume = clampf(float(d.get("masterVolume", 1.0)), 0.0, 1.0)
		sfx_volume = clampf(float(d.get("sfxVolume", 1.0)), 0.0, 1.0)
		voice_volume = clampf(float(d.get("voiceVolume", 1.0)), 0.0, 1.0)
		muted = bool(d.get("muted", false))
	_apply_volumes()


func save_settings() -> void:
	var d := {
		"masterVolume": master_volume,
		"sfxVolume": sfx_volume,
		"voiceVolume": voice_volume,
		"muted": muted,
	}
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))


# ---------------------------------------------------------------------------
# 音量 API
# ---------------------------------------------------------------------------

func _db(v: float) -> float:
	# 線性 0.0~1.0 → dB（0 時為靜音）
	if v <= 0.0:
		return MIN_DB
	return lerpf(MAX_DB, MIN_DB, 1.0 - v)


func _apply_volumes() -> void:
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(BUS_MASTER), _db(master_volume if not muted else 0.0))
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(BUS_SFX), _db(sfx_volume))
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index(BUS_VOICE), _db(voice_volume))


func set_master_volume(v: float) -> void:
	master_volume = clampf(v, 0.0, 1.0)
	_apply_volumes()
	save_settings()


func set_sfx_volume(v: float) -> void:
	sfx_volume = clampf(v, 0.0, 1.0)
	_apply_volumes()
	save_settings()


func set_voice_volume(v: float) -> void:
	voice_volume = clampf(v, 0.0, 1.0)
	_apply_volumes()
	save_settings()


func set_muted(m: bool) -> void:
	muted = m
	_apply_volumes()
	save_settings()


func toggle_muted() -> bool:
	set_muted(not muted)
	return muted


# ---------------------------------------------------------------------------
# 雙軌音效載入：實體檔優先，否則程式化生成
# ---------------------------------------------------------------------------

func _load_streams() -> void:
	for name in SFX_FILES:
		var path: String = SFX_FILES[name]
		var stream: AudioStream = null
		if ResourceLoader.exists(path):
			stream = load(path) as AudioStream
		if stream == null:
			stream = _generate_stream(name)
		_streams[name] = stream


## 程式化生成音效（無實體檔時使用，確保不報錯）：
##   * discard: Pop（低頻落桌短音）
##   * draw:    Click（中頻短促）
##   * button:  Tick（高頻極短）
##   * chi/peng/kong/win/settle: 組合音（滑音/和弦）
func _generate_stream(name: String) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = 22050
	stream.stereo = false

	var data: PackedByteArray
	match name:
		"discard":
			data = _synthesize(22050, 0.12, 520.0, 160.0, 0.4, 0.001)
		"draw":
			data = _synthesize(22050, 0.07, 880.0, 620.0, 0.3, 0.002)
		"button":
			data = _synthesize(22050, 0.05, 1320.0, 900.0, 0.2, 0.003)
		"chi":
			data = _synthesize(22050, 0.16, 660.0, 440.0, 0.35, 0.002)
		"peng":
			data = _synthesize(22050, 0.16, 520.0, 330.0, 0.35, 0.002)
		"kong":
			data = _synthesize(22050, 0.22, 392.0, 196.0, 0.45, 0.003)
		"win":
			data = _synthesize_chord(22050, 0.4, [523.0, 659.0, 784.0, 1046.0], 0.5)
		"settle":
			data = _synthesize_chord(22050, 0.3, [392.0, 523.0, 659.0], 0.4)
		"turn":
			data = _synthesize_chord(22050, 0.28, [587.33, 880.0, 1174.66], 0.45)
		"alert":
			data = _synthesize(22050, 0.08, 988.0, 988.0, 0.3, 0.002)
		_:
			data = _synthesize(22050, 0.1, 500.0, 300.0, 0.3, 0.002)

	stream.data = data
	return stream


## 單音合成：頻率從 f0 滑到 f1，指數衰減。
func _synthesize(
	mix_rate: int, duration: float, f0: float, f1: float, amp: float, fade_in: float
) -> PackedByteArray:
	var n := int(mix_rate * duration)
	var data := PackedByteArray()
	data.resize(n * 2)
	var phase := 0.0
	for i in range(n):
		var t := float(i) / n
		var freq := lerpf(f0, f1, t)
		phase += freq * TAU / float(mix_rate)
		var env := amp * exp(-5.0 * t) * minf(1.0, t / maxf(fade_in, 0.0001))
		var s := sin(phase) * env
		var v := int(clampf(s, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, v)
	return data


## 和弦合成（疊加多頻率）。
func _synthesize_chord(mix_rate: int, duration: float, freqs: Array, amp: float) -> PackedByteArray:
	var n := int(mix_rate * duration)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in range(n):
		var t := float(i) / n
		var env := amp * exp(-4.0 * t)
		var s := 0.0
		for f in freqs:
			s += sin(TAU * float(f) * float(i) / float(mix_rate)) * env / float(freqs.size())
		var v := int(clampf(s, -1.0, 1.0) * 32767.0)
		data.encode_s16(i * 2, v)
	return data


# ---------------------------------------------------------------------------
# 播放
# ---------------------------------------------------------------------------

func _create_pool() -> void:
	for i in range(8):
		var p := AudioStreamPlayer.new()
		p.bus = BUS_SFX
		add_child(p)
		_sfx_pool.append(p)


func _next_player() -> AudioStreamPlayer:
	var p: AudioStreamPlayer = _sfx_pool[_pool_index]
	_pool_index = (_pool_index + 1) % _sfx_pool.size()
	return p


## 播放音效（名稱必須在 SFX_FILES 內）。
func play_sfx(name: String, volume_db: float = 0.0) -> void:
	if muted:
		return
	var stream: AudioStream = _streams.get(name)
	if stream == null:
		push_warning("AudioManager: 沒有音效 %s" % name)
		return
	var p := _next_player()
	p.stream = stream
	p.volume_db = volume_db
	p.play()


## 語音播放（獨立 Voice bus；目前無語音檔，預留 API）。
func play_voice(name: String, volume_db: float = 0.0) -> void:
	if muted:
		return
	if _voice_player == null:
		_voice_player = AudioStreamPlayer.new()
		_voice_player.bus = BUS_VOICE
		add_child(_voice_player)
	var path := "res://audio/%s.ogg" % name
	if not ResourceLoader.exists(path):
		return
	_voice_player.stream = load(path) as AudioStream
	_voice_player.volume_db = volume_db
	_voice_player.play()


# ---------------------------------------------------------------------------
# 語意化快捷（供 table.gd 呼叫）
# ---------------------------------------------------------------------------

func play_discard() -> void:
	play_sfx("discard")


func play_draw() -> void:
	play_sfx("draw")


func play_button() -> void:
	play_sfx("button")


func play_meld(kind: String) -> void:
	match kind:
		"chi":
			play_sfx("chi")
		"peng":
			play_sfx("peng")
		"kong":
			play_sfx("kong")
		_:
			play_sfx("button")


func play_win() -> void:
	play_sfx("win")


func play_settle() -> void:
	play_sfx("settle")


## 輪到我方出牌提示音（清脆和弦音）。
func play_turn_start() -> void:
	play_sfx("turn")


## 倒數最後 5 秒緊急警示音。
func play_alert() -> void:
	play_sfx("alert")

