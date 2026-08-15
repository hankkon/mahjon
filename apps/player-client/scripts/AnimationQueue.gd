extends Node
## AnimationQueue — 依序播放的 UI 動畫佇列管理器。
##
## 將伺服器快照之間的差異拆解為一連串「動畫 job」並依序播放：
##   * 摸牌滑入手牌（draw fly-in）
##   * 棄牌飛入中央棄牌池（discard fly-out）
##   * 吃碰槓牌面組合移動（meld fly）
##
## 每個 job 是一個 Callable：呼叫後啟動 Tween 並「回傳該 Tween」，
## 佇列會等待它完成才播放下一個（回傳 null 表示同步完成）。
## 全部播完後發出 queue_drained。
##
## 播放期間呼叫 is_playing() 判斷是否仍在動畫中 — UI 應鎖定玩家輸入
## （牌桌由 table.gd 負責鎖定手牌與反應按鈕），避免畫面瞬間跳變。

signal queue_drained

var _pending: Array[Callable] = []
var _playing := false


## 是否正在播放動畫（佇列尚未清空）。
func is_playing() -> bool:
	return _playing


## 加入一個動畫 job。job() 需啟動一個 Tween 並回傳它（null = 立即完成）。
func enqueue(job: Callable) -> void:
	_pending.append(job)
	if not _playing:
		_advance()


## 清除尚未播放的 job（進行中的動畫不受影響）。
func clear() -> void:
	_pending.clear()


func _advance(_arg: Variant = null) -> void:
	if _pending.is_empty():
		if _playing:
			_playing = false
			queue_drained.emit()
		return
	_playing = true
	var job: Callable = _pending.pop_front()
	var tween: Tween = job.call()
	if tween == null:
		# 同步完成的 job：延到下一個影格再推進，避免深層遞迴。
		_advance.call_deferred()
		return
	tween.finished.connect(_advance, CONNECT_ONE_SHOT)
