extends Node
## tile_loader.gd — 麻將牌「牌型代號 (TileId) → PNG 貼圖」統一載入器（Autoload: TileLoader）。
##
## 後端傳來的牌型代號格式（TileId）與資產檔名對應（Wikimedia Commons 3D 麻將圖庫）：
##   * 萬子 wan:1 ~ wan:9    → res://assets/tiles/wan_1.png ... wan_9.png
##   * 筒子 tong:1 ~ tong:9  → res://assets/tiles/tong_1.png ... tong_9.png
##   * 條子 tiao:1 ~ tiao:9  → res://assets/tiles/tiao_1.png ... tiao_9.png
##   * 字牌 honor:dong/nan/xi/bei/zhong/fa/bai → east/south/west/north/red/green/white.png
##   * 花牌 flower:mei/lan/zhu/ju/chun/xia/qiu/dong → flower_*.png
##   * 牌背                       → res://assets/tiles/back.png
##
## 載入策略（保證任何環境都顯示圖片、絕不退回純文字）：
##   1) 優先使用 Godot 已匯入的資源（.import 存在 → load() 回傳壓縮貼圖）。
##   2) 尚未匯入（檔案剛生成、未開過編輯器）→ 用 Image.load_from_file()
##      直接讀 PNG 並建立 ImageTexture。
##   3) 連 PNG 都不存在 → 動態生成象牙白 + 花色邊框的佔位貼圖（仍是貼圖）。
##
## 全專案（手牌 / 中央棄牌河 / 副露 / 摸棄飛行動畫 / 對手牌背 / 最後棄牌）
## 都必須透過這裡取得貼圖與 TextureRect，確保統一渲染。

const BASE_PATH := "res://assets/tiles/"
const FACE_W := 48.0   # 標準牌面寬（px）
const FACE_H := 64.0   # 標準牌面高（px）

## 貼圖快取：key = "wan_5" / "east" / "flower_mei" / "back"。
var _cache: Dictionary = {}


## 依牌型代號回傳「牌面」貼圖（找不到對應 PNG 時生成佔位貼圖；空代號回 null）。
func face_texture(tile_id: String) -> Texture2D:
	if tile_id == "":
		return null
	var key := _tile_key(tile_id)
	if key == "":
		return null
	return _texture(key, tile_id)


## 回傳「牌背」貼圖（back.png）。
func back_texture() -> Texture2D:
	return _texture("back", "back")


func _texture(key: String, fallback_id: String) -> Texture2D:
	if _cache.has(key):
		return _cache[key]
	var tex := _load_png(key + ".png")
	if tex == null:
		tex = _placeholder_texture(fallback_id)
	_cache[key] = tex
	return tex


## 從專案資產資料夾載入 PNG；匯入資源優先，未匯入則直接讀檔。
func _load_png(file_name: String) -> Texture2D:
	var path := BASE_PATH + file_name
	# 1) 已匯入（存在 .import 側車檔）→ 用 ResourceLoader 載入壓縮貼圖。
	#    未匯入的 PNG 不可直接 load()（會報「No loader found」錯誤）。
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Texture2D:
			return res
	# 2) 尚未匯入（檔案剛生成、未開過編輯器）→ 直接讀原始 PNG。
	if FileAccess.file_exists(path):
		var img := Image.load_from_file(path)
		if img != null:
			return ImageTexture.create_from_image(img)
	# 3) 連 PNG 都不存在 → 回 null（由 _texture() 生成佔位貼圖）。
	return null


## 建立一張牌面 TextureRect（含 meta["tile_id"] 供 QA/除錯查詢）。
## size 預設 48x64，貼圖以「保持比例、置中」縮放，絕不變形。
func make_tile_rect(tile_id: String, size: Vector2 = Vector2(FACE_W, FACE_H)) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = face_texture(tile_id)
	_configure_rect(tr, size)
	tr.set_meta("tile_id", tile_id)
	return tr


## 建立一張牌背 TextureRect。
func make_back_rect(size: Vector2 = Vector2(FACE_W, FACE_H)) -> TextureRect:
	var tr := TextureRect.new()
	tr.texture = back_texture()
	_configure_rect(tr, size)
	return tr


## 更新既有 TextureRect 的牌面貼圖（用於最後棄牌大牌面等）。
func apply_face(tr: TextureRect, tile_id: String) -> void:
	tr.texture = face_texture(tile_id)
	tr.set_meta("tile_id", tile_id)


func _configure_rect(tr: TextureRect, size: Vector2) -> void:
	tr.custom_minimum_size = size
	tr.size = size
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE


## ---------------------------------------------------------------------------
## 資產檔名對應（TileId → 本專案 assets/tiles/ 內的真實 PNG 檔名基底）
## ---------------------------------------------------------------------------
## 以下三個 Dictionary 與 `apps/player-client/assets/tiles/` 內實際存在的檔名
## 100% 對應（43 個檔案）。任何新增/改名都必須同步更新這裡，否則會退回佔位貼圖。

## 花色（萬/筒/條）代號 → 檔名前綴。數字 1~9 會接在後面：wan:5 → "wan_5"。
const SUIT_PREFIX := {
	"wan": "wan",
	"tong": "tong",
	"tiao": "tiao",
}

## 字牌 honor 代號 → 檔名基底（Wikimedia 3D 圖庫檔名）。
##   honor:dong → east / honor:nan → south / honor:xi → west / honor:bei → north
##   honor:zhong → red / honor:fa → green / honor:bai → white
const HONOR_TO_WIKIMEDIA := {
	"dong": "east",
	"nan": "south",
	"xi": "west",
	"bei": "north",
	"zhong": "red",
	"fa": "green",
	"bai": "white",
}

## 花牌 flower 代號 → 檔名基底（Wikimedia 3D 圖庫檔名）。
##   mei→梅 / lan→蘭 / zhu→竹 / ju→菊 / chun→春 / xia→夏 / qiu→秋 / dong→冬
const FLOWER_TO_LOCAL := {
	"mei": "flower_mei",
	"lan": "flower_lan",
	"zhu": "flower_zhu",
	"ju": "flower_ju",
	"chun": "flower_chun",
	"xia": "flower_xia",
	"qiu": "flower_qiu",
	"dong": "flower_dong",
}

## 牌背檔名基底。
const BACK_KEY := "back"


## 把 TileId（"wan:5"）轉成資產檔名基底（"wan_5"）；不合法回 ""。
func _tile_key(tile_id: String) -> String:
	var parts := tile_id.split(":")
	if parts.size() < 2:
		return ""
	var cat := parts[0]
	var val := parts[1]
	match cat:
		"wan", "tong", "tiao":
			if SUIT_PREFIX.has(cat) and val.is_valid_int():
				var n := val.to_int()
				if n >= 1 and n <= 9:
					return "%s_%d" % [SUIT_PREFIX[cat], n]
		"honor":
			if HONOR_TO_WIKIMEDIA.has(val):
				return HONOR_TO_WIKIMEDIA[val]
		"flower":
			if FLOWER_TO_LOCAL.has(val):
				return FLOWER_TO_LOCAL[val]
	return ""


## 驗證 assets/tiles/ 內所有預期檔名都存在；回傳缺失清單（空 = 全部就緒）。
## 供 QA / 啟動時檢查，確保映射與真實檔案 100% 對齊。
func validate_assets() -> Array:
	var missing: Array = []
	for cat in SUIT_PREFIX:
		for n in range(1, 10):
			var key := "%s_%d" % [SUIT_PREFIX[cat], n]
			if not FileAccess.file_exists(BASE_PATH + key + ".png"):
				missing.append(key + ".png")
	for key in HONOR_TO_WIKIMEDIA.values():
		if not FileAccess.file_exists(BASE_PATH + key + ".png"):
			missing.append(key + ".png")
	for key in FLOWER_TO_LOCAL.values():
		if not FileAccess.file_exists(BASE_PATH + key + ".png"):
			missing.append(key + ".png")
	if not FileAccess.file_exists(BASE_PATH + BACK_KEY + ".png"):
		missing.append(BACK_KEY + ".png")
	return missing


## 兜底佔位貼圖：象牙白底 + 花色邊框 + 中央色塊（仍是圖片，非文字）。
func _placeholder_texture(tile_id: String) -> Texture2D:
	var img := Image.create(96, 128, false, Image.FORMAT_RGBA8)
	var parts := tile_id.split(":")
	var cat: String = parts[0] if parts.size() >= 2 else ""
	var accent := Color(0.45, 0.38, 0.32)
	match cat:
		"wan":
			accent = Color(0.12, 0.32, 0.58)
		"tong":
			accent = Color(0.6, 0.22, 0.2)
		"tiao":
			accent = Color(0.12, 0.5, 0.3)
		"honor":
			accent = Color(0.55, 0.38, 0.12)
		"flower":
			accent = Color(0.6, 0.42, 0.1)
	img.fill(Color(0.98, 0.97, 0.95, 1.0))
	# 四邊花色框
	img.fill_rect(Rect2i(0, 0, 96, 6), accent)
	img.fill_rect(Rect2i(0, 122, 96, 6), accent)
	img.fill_rect(Rect2i(0, 0, 6, 128), accent)
	img.fill_rect(Rect2i(90, 0, 6, 128), accent)
	# 中央色塊
	img.fill_rect(Rect2i(26, 44, 44, 40), accent)
	return ImageTexture.create_from_image(img)
