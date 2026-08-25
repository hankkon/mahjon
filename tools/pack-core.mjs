/**
 * pack-core.mjs — 僅打包專案「核心重點架構與業務邏輯」檔案供其他 AI 閱讀。
 * 排除大型測試 fixture、打包腳本與次要 UI 細節，大幅節省 Token。
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// 專案最核心的 14 個重點檔案（領域規則、權威伺服器、狀態快照、網路協定、客戶端通訊）
const CORE_FILES = [
  "docs/spec.md",
  "packages/rules/src/tiles.ts",
  "packages/rules/src/game.ts",
  "packages/rules/src/wall.ts",
  "packages/rules/src/win.ts",
  "packages/rules/src/scoring.ts",
  "packages/rules/src/dice.ts",
  "packages/rules/src/wait.ts",
  "apps/server/src/protocol.ts",
  "apps/server/src/snapshot.ts",
  "apps/server/src/room.ts",
  "apps/server/src/roomManager.ts",
  "apps/server/src/wss.ts",
  "apps/player-client/scripts/NetworkManager.gd",
];

const lines = [];
lines.push("# 台灣 16 張麻將 — 專案核心重點架構 (AI Context Pack)");
lines.push("");
lines.push("> 本文件彙整專案的核心架構、伺服器權威邏輯、規則領域模型、通訊協定與安全防護層。");
lines.push("> 適合直接提供給 LLM (ChatGPT / Claude / Gemini) 進行架構分析、功能擴充或優化建議。");
lines.push("");
lines.push(`- **打包時間**：${new Date().toISOString()}`);
lines.push(`- **核心檔案數**：${CORE_FILES.length} 個精華檔案`);
lines.push("");
lines.push("---");
lines.push("");

for (const rel of CORE_FILES) {
  const abs = join(ROOT, rel);
  try {
    const content = readFileSync(abs, "utf8");
    const lang = rel.endsWith(".ts")
      ? "typescript"
      : rel.endsWith(".gd")
        ? "gdscript"
        : rel.endsWith(".md")
          ? "markdown"
          : "";
    lines.push(`## File: \`${rel}\``);
    lines.push("");
    lines.push("```" + lang);
    lines.push(content.trim());
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  } catch (err) {
    console.warn(`⚠ 讀取失敗: ${rel}`, err);
  }
}

const outPath = join(ROOT, "ai-core-context.md");
writeFileSync(outPath, lines.join("\n"), "utf8");
const sizeKb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✅ 核心精華已打包 → ai-core-context.md (${sizeKb} KB)`);
