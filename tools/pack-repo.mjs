/**
 * pack-repo.mjs — 把專案打包成單一 Markdown 檔（供 AI 分析用）。
 *
 * 用法：node tools/pack-repo.mjs
 * 輸出：repomix-output.md（覆蓋舊檔）
 *
 * 自動搜尋專案中所有文字原始碼、設定檔、文檔與 Godot 場景/腳本，
 * 排除 node_modules, .git, .godot, export, 貼圖/字型等二進位檔案。
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// 排除的資料夾名稱
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".godot",
  "dist",
  "export",
  "assets",
  "data",
  "shader_cache",
  ".import",
  "coverage",
]);

// 排除的檔案名稱或副檔名
const IGNORED_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".otf",
  ".ttf",
  ".woff",
  ".woff2",
  ".import",
  ".uid",
  ".bin",
  ".pck",
  ".wasm",
  ".zip",
  ".tar",
  ".gz",
  ".lock",
]);

const IGNORED_FILES = new Set([
  "repomix-output.md",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
]);

// 支援打包的檔案類型
const ALLOWED_EXTS = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".gd",
  ".tscn",
  ".cfg",
  ".toml",
  ".sh",
  ".py",
  ".example",
  ".dockerignore",
  ".gitignore",
]);

function isAllowedFile(fileName) {
  if (IGNORED_FILES.has(fileName)) return false;
  if (fileName.startsWith(".git") && fileName !== ".gitignore") return false;
  if (fileName === "Dockerfile" || fileName === "project.godot" || fileName === ".dockerignore" || fileName === ".gitignore" || fileName === ".env.example") {
    return true;
  }
  const ext = extname(fileName);
  if (IGNORED_EXTS.has(ext)) return false;
  return ALLOWED_EXTS.has(ext);
}

function collectTree(dir, prefix = "") {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  for (const name of entries.sort()) {
    if (name.startsWith(".") && !name.startsWith(".env") && name !== ".gitignore" && name !== ".dockerignore") {
      if (name === ".git" || name === ".godot" || name === ".github") continue;
    }
    const full = join(dir, name);
    const rel = prefix + name;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      if (IGNORED_DIRS.has(name)) continue;
      out.push(`${rel}/`);
      out.push(...collectTree(full, `${rel}/`));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function collectSourceFiles(dir, prefix = "") {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  for (const name of entries.sort()) {
    if (name.startsWith(".") && !name.startsWith(".env") && name !== ".gitignore" && name !== ".dockerignore") {
      if (name === ".git" || name === ".godot" || name === ".github") continue;
    }
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }

    if (st.isDirectory()) {
      if (IGNORED_DIRS.has(name)) continue;
      files.push(...collectSourceFiles(full, rel));
    } else {
      if (isAllowedFile(name)) {
        files.push(rel);
      }
    }
  }
  return files;
}

function getLang(filePath) {
  const ext = extname(filePath);
  switch (ext) {
    case ".ts":
    case ".js":
    case ".mjs":
    case ".cjs":
      return "typescript";
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".md":
      return "markdown";
    case ".gd":
      return "gdscript";
    case ".tscn":
    case ".cfg":
      return "ini";
    case ".toml":
      return "toml";
    case ".sh":
      return "bash";
    case ".py":
      return "python";
    default:
      return "";
  }
}

const now = new Date().toISOString();
const allFiles = collectSourceFiles(ROOT);
const lines = [];

lines.push("This file is a merged representation of the codebase, containing all project source files, combined into a single document for AI analysis.");
lines.push("The content has been processed where security check has been disabled.");
lines.push("");
lines.push("# File Summary");
lines.push("");
lines.push("## Purpose");
lines.push("This file contains a packed representation of the Taiwan 16-Tile Mahjong repository's contents.");
lines.push("It includes the core rule engine (packages/rules), authoritative game server (apps/server), Godot 4 client scripts/scenes (apps/player-client), and documentation.");
lines.push("It is designed to be easily consumable by AI systems for architecture review, bug detection, rule verification, and optimization suggestions.");
lines.push("");
lines.push("## File Format");
lines.push("The content is organized as follows:");
lines.push("1. This summary section");
lines.push("2. Repository information and directory structure");
lines.push("3. File content blocks: `## File: <path>` followed by the exact source code in markdown code blocks.");
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

for (const rel of allFiles) {
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
  lines.push("```" + (getLang(rel) || ""));
  lines.push(content.replace(/\n$/, ""));
  lines.push("```");
  lines.push("");
}

const outPath = join(ROOT, "repomix-output.md");
writeFileSync(outPath, lines.join("\n"), "utf8");
const sizeKb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✅ 已打包 ${allFiles.length} 個原始碼檔案 → repomix-output.md (${sizeKb} KB)`);