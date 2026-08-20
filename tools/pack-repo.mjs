/**
 * pack-repo.mjs — 把專案打包成單一 Markdown 檔（供 AI 分析用）。
 *
 * 用法：node tools/pack-repo.mjs
 * 輸出：repomix-output.md（覆蓋舊檔）
 *
 * 格式與 repomix 一致：標頭摘要 + 目錄結構 + 每個檔案以
 * `## File: <路徑>` + 程式碼區塊呈現。
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// 與現有 repomix-output.md 相同涵蓋範圍（不含二進位 / 貼圖 / export）。
const FILES = [
  // —— 根目錄設定 ——
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "DEPLOYMENT.md",
  "docker-compose.yml",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  // —— packages/rules ——
  "packages/rules/package.json",
  "packages/rules/tsconfig.json",
  "packages/rules/src/chi.ts",
  "packages/rules/src/game.ts",
  "packages/rules/src/index.ts",
  "packages/rules/src/kong.ts",
  "packages/rules/src/peng.ts",
  "packages/rules/src/reactions.ts",
  "packages/rules/src/rng.ts",
  "packages/rules/src/scoring.ts",
  "packages/rules/src/tiles.ts",
  "packages/rules/src/types.ts",
  "packages/rules/src/wall.ts",
  "packages/rules/src/win.ts",
  "packages/rules/src/__tests__/chi.test.ts",
  "packages/rules/src/__tests__/helpers.ts",
  "packages/rules/src/__tests__/kong.test.ts",
  "packages/rules/src/__tests__/peng.test.ts",
  "packages/rules/src/__tests__/scoring.test.ts",
  "packages/rules/src/__tests__/wall.test.ts",
  "packages/rules/src/__tests__/win.test.ts",
  // —— apps/server ——
  "apps/server/package.json",
  "apps/server/tsconfig.json",
  "apps/server/Dockerfile",
  "apps/server/README.md",
  "apps/server/observe_ws.cjs",
  "apps/server/src/index.ts",
  "apps/server/src/protocol.ts",
  "apps/server/src/room.ts",
  "apps/server/src/roomManager.ts",
  "apps/server/src/snapshot.ts",
  "apps/server/src/wss.ts",
  "apps/server/src/gameLoop.ts",
  "apps/server/src/aiController.ts",
  "apps/server/src/aiPlayer.ts",
  "apps/server/src/serve.ts",
  "apps/server/src/serve-web.ts",
  "apps/server/src/__tests__/room.test.ts",
  "apps/server/src/__tests__/wss.test.ts",
  "apps/server/src/scripts/ai-smoke.ts",
  "apps/server/src/scripts/qa-e2e.ts",
  "apps/server/src/scripts/qa-stress.ts",
  "apps/server/src/scripts/simulate-match.ts",
  // —— apps/player-client ——
  "apps/player-client/project.godot",
  "apps/player-client/export_presets.cfg",
  "apps/player-client/README.md",
  "apps/player-client/scenes/Main.tscn",
  "apps/player-client/scenes/Table.tscn",
  "apps/player-client/scenes/TileButton.tscn",
  "apps/player-client/scripts/AnimationQueue.gd",
  "apps/player-client/scripts/AudioManager.gd",
  "apps/player-client/scripts/GameState.gd",
  "apps/player-client/scripts/main.gd",
  "apps/player-client/scripts/NetworkManager.gd",
  "apps/player-client/scripts/table.gd",
  "apps/player-client/scripts/tile_loader.gd",
  "apps/player-client/scripts/TileButton.gd",
  "apps/player-client/qa_render_check.gd",
  "apps/player-client/qa_render_check.tscn",
  // —— docs / tools / nginx ——
  "docs/GROK_UI_OVERHAUL_PROMPT.md",
  "docs/HARD_FIX_REPORT.md",
  "docs/OVERNIGHT_REPORT.md",
  "docs/qa-e2e-report.md",
  "docs/qa-polish-report.md",
  "docs/spec.md",
  "tools/download_wikimedia_tiles.py",
  "tools/gen_tiles.py",
  "nginx/entrypoint.sh",
  "nginx/nginx.conf",
];

// ---------------------------------------------------------------------------

function collectTree(dir, prefix = "") {
  const out = [];
  const entries = readdirSafe(dir);
  for (const name of entries.sort()) {
    const full = join(dir, name);
    const rel = prefix + name;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", "dist", ".git", "export", "assets", "data", ".godot", "shader_cache", ".import"].includes(name)) continue;
      out.push(`${rel}/`);
      out.push(...collectTree(full, `${rel}/`));
    } else {
      out.push(rel);
    }
  }
  return out;
}

import { readdirSync } from "node:fs";
function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const now = new Date().toISOString();
const lines = [];
lines.push("This file is a merged representation of the codebase, containing specifically included files, combined into a single document by Repomix.");
lines.push("The content has been processed where security check has been disabled.");
lines.push("");
lines.push("# File Summary");
lines.push("");
lines.push("## Purpose");
lines.push("This file contains a packed representation of the repository's contents that is considered the most important context.");
lines.push("It is designed to be easily consumable by AI systems for analysis, code review, or other automated processes.");
lines.push("");
lines.push("## File Format");
lines.push("The content is organized as follows:");
lines.push("1. This summary section");
lines.push("2. Repository information");
lines.push("3. Directory structure");
lines.push("4. Repository files (if enabled)");
lines.push("5. Multiple file entries, each consisting of:");
lines.push("  a. A header with the file path (## File: path/to/file)");
lines.push("  b. The full contents of the file in a code block");
lines.push("");
lines.push("## Usage");
lines.push("This file is intended to be passed to an AI system as context for understanding the codebase.");
lines.push("");
lines.push("Generated: " + now);
lines.push("");
lines.push("# Repository Information");
lines.push("");
lines.push("## Repository Structure");
lines.push("");
lines.push("```");
lines.push("taiwan-mahjong1/");
lines.push(...collectTree(ROOT));
lines.push("```");
lines.push("");
lines.push("# Repository Files");
lines.push("");

for (const rel of FILES) {
  const abs = join(ROOT, rel);
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch (err) {
    console.warn(`⚠ 略過（讀不到）：${rel}`);
    continue;
  }
  lines.push(`## File: ${rel}`);
  lines.push("");
  lines.push("```");
  lines.push(content.replace(/\n$/, ""));
  lines.push("```");
  lines.push("");
}

const outPath = join(ROOT, "repomix-output.md");
writeFileSync(outPath, lines.join("\n"));
const sizeKb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✅ 已打包 ${FILES.length} 個檔案 → repomix-output.md (${sizeKb} KB)`);