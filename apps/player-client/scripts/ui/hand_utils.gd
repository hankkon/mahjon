## HandUtils — 手牌「純函式」工具（無節點、無狀態）。
## 注意：刻意「不」宣告 class_name — 新增 global class 需編輯器掃描，
## headless CI 第一次跑會抓不到。改用 table.gd 的 preload 引用最穩。
##
## 從 table.gd 抽出，行為完全不變。目的：讓 table.gd 變瘦、且這些純邏輯
## 可被測試/未來 view 重用。禁止在此放任何 GameState/節點依賴；需要狀態的
## 邏輯（摸牌辨識、spacer）留在 table.gd。

## 花色排序（萬 → 筒 → 條 → 字 → 花）。
const SUIT_RANK := {"wan": 0, "tong": 1, "tiao": 2, "honor": 3, "flower": 4}
const HONOR_RANK := {
	"dong": 1, "nan": 2, "xi": 3, "bei": 4,
	"zhong": 5, "fa": 6, "bai": 7,
}
const FLOWER_RANK := {
	"mei": 1, "lan": 2, "zhu": 3, "ju": 4,
	"chun": 5, "xia": 6, "qiu": 7, "dong": 8,
}


## 單張牌的排序鍵：花色優先，同花色由小到大。
static func tile_sort_key(t: Dictionary) -> int:
	var parts := str(t.get("id", "")).split(":")
	if parts.size() < 2:
		return 999999
	var cat: String = parts[0]
	var val: String = parts[1]
	var rank: int = int(SUIT_RANK.get(cat, 9))
	var num := 0
	if cat == "honor":
		num = int(HONOR_RANK.get(val, 0))
	elif cat == "flower":
		num = int(FLOWER_RANK.get(val, 0))
	else:
		num = val.to_int()
	return rank * 1000 + num


## 依「花色與順序」排序後回傳（同張以 instanceId 穩定排序）。
static func sorted_hand(hand: Array) -> Array:
	var out: Array = hand.duplicate()
	out.sort_custom(func(a, b) -> bool:
		var ka := tile_sort_key(a)
		var kb := tile_sort_key(b)
		if ka != kb:
			return ka < kb
		return int(a.get("instanceId", -1)) < int(b.get("instanceId", -1)))
	return out


## 手牌內容是否相同（以 instanceId 集合比對，順序無關 — 排序屬客戶端美化）。
static func hand_equals(a: Array, b: Array) -> bool:
	if a.size() != b.size():
		return false
	var set_a := {}
	for t in a:
		set_a[int(t.get("instanceId", -1))] = true
	for t in b:
		if not set_a.has(int(t.get("instanceId", -1))):
			return false
	return true


## 手牌順序是否完全相同（依序比對 instanceId）。
static func order_equals(a: Array, b: Array) -> bool:
	if a.size() != b.size():
		return false
	for i in range(a.size()):
		if int(a[i].get("instanceId", -1)) != int(b[i].get("instanceId", -1)):
			return false
	return true