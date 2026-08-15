#!/usr/bin/env python3
"""
download_wikimedia_tiles.py
===========================

從 Wikimedia Commons 的「PNG 3D Mahjong tiles」圖庫（Martin Persson 的免費 3D 麻將
圖示集，CC-BY-4.0）下載全套 3D 麻將牌面 PNG，並存到
`apps/player-client/assets/tiles/`。

命名對應（Wikimedia 檔名 → 本專案 tile_loader.gd 使用的檔名基底）：

  * 萬子  Mpt1m..Mpt9m  → wan_1..wan_9
  * 筒子  Mpt1p..Mpt9p  → tong_1..tong_9
  * 條子  Mpt1s..Mpt9s  → tiao_1..tiao_9
  * 字牌  Mpt1z..Mpt7z  → east/south/west/north/white/green/red
  * 花牌  Mpt1q..Mpt8q  → flower_chun/xia/qiu/dong/mei/lan/ju/zhu
  * 牌背  Mpt00         → back

使用方式：
    python3 tools/download_wikimedia_tiles.py [--out DIR] [--dry-run] [--delay SEC]

預設輸出目錄為 `apps/player-client/assets/tiles/`。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# Wikimedia Commons API 端點
API = "https://commons.wikimedia.org/w/api.php"

# 本專案根目錄（此檔位於 <root>/tools/ 下）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "apps", "player-client", "assets", "tiles")

# Wikimedia 檔名 → 本專案檔名基底
# 依 Wikimedia 的 Unicode 分類（U+1F000..U+1F02F）確認：
#   z 系列 = 字牌（東南西北白發中），q 系列 = 花牌（春夏秋冬梅蘭菊竹）
WIKIMEDIA_TO_LOCAL = {
    # 萬子 wan
    "Mpt1m.png": "wan_1", "Mpt2m.png": "wan_2", "Mpt3m.png": "wan_3",
    "Mpt4m.png": "wan_4", "Mpt5m.png": "wan_5", "Mpt6m.png": "wan_6",
    "Mpt7m.png": "wan_7", "Mpt8m.png": "wan_8", "Mpt9m.png": "wan_9",
    # 筒子 tong
    "Mpt1p.png": "tong_1", "Mpt2p.png": "tong_2", "Mpt3p.png": "tong_3",
    "Mpt4p.png": "tong_4", "Mpt5p.png": "tong_5", "Mpt6p.png": "tong_6",
    "Mpt7p.png": "tong_7", "Mpt8p.png": "tong_8", "Mpt9p.png": "tong_9",
    # 條子 tiao
    "Mpt1s.png": "tiao_1", "Mpt2s.png": "tiao_2", "Mpt3s.png": "tiao_3",
    "Mpt4s.png": "tiao_4", "Mpt5s.png": "tiao_5", "Mpt6s.png": "tiao_6",
    "Mpt7s.png": "tiao_7", "Mpt8s.png": "tiao_8", "Mpt9s.png": "tiao_9",
    # 字牌 honor（東南西北白發中）
    "Mpt1z.png": "east",   # U+1F000 東
    "Mpt2z.png": "south",  # U+1F001 南
    "Mpt3z.png": "west",   # U+1F002 西
    "Mpt4z.png": "north",  # U+1F003 北
    "Mpt5z.png": "white",  # U+1F006 白
    "Mpt6z.png": "green",  # U+1F005 發
    "Mpt7z.png": "red",    # U+1F004 中
    # 花牌 flower（春夏秋冬梅蘭菊竹）
    "Mpt1q.png": "flower_chun",  # U+1F026 春
    "Mpt2q.png": "flower_xia",   # U+1F027 夏
    "Mpt3q.png": "flower_qiu",   # U+1F028 秋
    "Mpt4q.png": "flower_dong",  # U+1F029 冬
    "Mpt5q.png": "flower_mei",   # U+1F022 梅
    "Mpt6q.png": "flower_lan",   # U+1F023 蘭
    "Mpt7q.png": "flower_ju",    # U+1F025 菊
    "Mpt8q.png": "flower_zhu",   # U+1F024 竹
    # 牌背 back
    "Mpt00.png": "back",
}

USER_AGENT = "taiwan-mahjong-tile-downloader/1.0 (personal project; contact: local)"


def api_get(params: dict, retries: int = 4) -> dict:
    """呼叫 Wikimedia Commons API，回傳 JSON；遇到 429/5xx 時指數退避重試。"""
    params = dict(params)
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  (API 429/5xx，{wait}s 後重試 {attempt + 1}/{retries})", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("API 重試次數用盡")


def resolve_all_urls(names: list[str]) -> dict[str, str]:
    """一次 API 呼叫批次解析所有檔案的實際下載 URL（避免逐檔查詢觸發限流）。"""
    result: dict[str, str] = {}
    # MediaWiki API 一次最多查 50 個標題，分批處理。
    for i in range(0, len(names), 50):
        batch = names[i:i + 50]
        titles = "|".join(f"File:{n}" for n in batch)
        data = api_get({
            "action": "query",
            "titles": titles,
            "prop": "imageinfo",
            "iiprop": "url|size",
        })
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            if title.startswith("File:"):
                name = title[len("File:"):]
            else:
                name = title
            ii = page.get("imageinfo")
            if ii:
                result[name] = ii[0].get("url")
        time.sleep(0.5)  # 批次間節流
    return result


def download(url: str, dest: str, delay: float, retries: int = 4) -> bool:
    """下載單一檔案到 dest；遇到 429/5xx 時指數退避重試。回傳是否成功。"""
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as f:
                f.write(resp.read())
            return True
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  (下載 429/5xx，{wait}s 後重試 {attempt + 1}/{retries})", file=sys.stderr)
                time.sleep(wait)
                continue
            print(f"  !! 下載失敗 {url}: {exc}", file=sys.stderr)
            return False
        except Exception as exc:  # noqa: BLE001
            print(f"  !! 下載失敗 {url}: {exc}", file=sys.stderr)
            return False
        finally:
            time.sleep(delay)  # 每個檔案下載後節流，避免觸發限流
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="下載 Wikimedia 3D 麻將牌面 PNG")
    parser.add_argument("--out", default=DEFAULT_OUT, help="輸出目錄（預設為 assets/tiles）")
    parser.add_argument("--dry-run", action="store_true", help="只列出將下載的對應，不下載")
    parser.add_argument("--delay", type=float, default=1.0, help="每個檔案下載間隔秒數（預設 1.0）")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    print(f"輸出目錄: {args.out}")
    print(f"共 {len(WIKIMEDIA_TO_LOCAL)} 個檔案\n")

    if args.dry_run:
        for wikimedia_name, local_base in WIKIMEDIA_TO_LOCAL.items():
            print(f"  {wikimedia_name:14s} -> {local_base}.png")
        return 0

    # 批次解析所有 URL
    names = list(WIKIMEDIA_TO_LOCAL.keys())
    print("批次解析 Wikimedia 檔案 URL…")
    urls = resolve_all_urls(names)
    print(f"解析完成：{len(urls)}/{len(names)} 個檔案有 URL\n")

    ok_count = 0
    fail_count = 0
    for wikimedia_name, local_base in WIKIMEDIA_TO_LOCAL.items():
        dest = os.path.join(args.out, f"{local_base}.png")
        url = urls.get(wikimedia_name)
        if url is None:
            print(f"  [找不到] {wikimedia_name} -> {local_base}.png")
            fail_count += 1
            continue
        if download(url, dest, args.delay):
            print(f"  [OK] {wikimedia_name:14s} -> {local_base}.png")
            ok_count += 1
        else:
            fail_count += 1

    print(f"\n完成：成功 {ok_count}，失敗 {fail_count} / 共 {len(WIKIMEDIA_TO_LOCAL)}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
