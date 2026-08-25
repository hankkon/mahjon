#!/usr/bin/env python3
"""
pack_zip.py — 將台灣十六張麻將專案打包成乾淨的原始碼 ZIP 壓縮檔。

自動排除：
- node_modules
- .git / .github
- dist / export / .godot / coverage / shader_cache
- .DS_Store / *.tmp / *.tgz / *.zip 等二進位或封裝檔案
"""

import os
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_ZIP = os.path.join(ROOT_DIR, "taiwan-mahjong-source.zip")

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".github",
    "dist",
    "export",
    ".godot",
    "coverage",
    "shader_cache",
    "__pycache__",
}

EXCLUDE_EXTS = {
    ".zip",
    ".tar",
    ".gz",
    ".tgz",
    ".wasm",
    ".pck",
    ".tmp",
}

EXCLUDE_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "taiwan-mahjong-source.zip",
}


def pack():
    total_files = 0
    total_size = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".git")]

            for file in files:
                if file in EXCLUDE_FILES or file.startswith(".DS_Store") or file.endswith(".tgz"):
                    continue
                ext = os.path.splitext(file)[1].lower()
                if ext in EXCLUDE_EXTS:
                    continue

                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, ROOT_DIR)
                zf.write(filepath, arcname)
                total_files += 1
                total_size += os.path.getsize(filepath)

    zip_size = os.path.getsize(OUTPUT_ZIP)
    print(f"✅ 打包完成！")
    print(f"   總檔案數: {total_files}")
    print(f"   原始大小: {total_size / (1024 * 1024):.2f} MB")
    print(f"   壓縮大小: {zip_size / (1024 * 1024):.2f} MB")
    print(f"   輸出檔案: {OUTPUT_ZIP}")


if __name__ == "__main__":
    pack()
