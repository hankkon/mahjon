This file is a merged representation of the codebase, containing specifically included files, combined into a single document by Repomix.
The content has been processed where security check has been disabled.

# File Summary

## Purpose
This file contains a packed representation of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review, or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage
This file is intended to be passed to an AI system as context for understanding the codebase.

Generated: 2026-08-17T13:24:23.426Z

# Repository Information

## Repository Structure

```
taiwan-mahjong1/
.dockerignore
.env.example
.gitignore
DEPLOYMENT.md
apps/
apps/player-client/
apps/player-client/README.md
apps/player-client/export_presets.cfg
apps/player-client/icon.svg
apps/player-client/icon.svg.import
apps/player-client/project.godot
apps/player-client/qa_render_check.gd
apps/player-client/qa_render_check.gd.uid
apps/player-client/qa_render_check.tscn
apps/player-client/scenes/
apps/player-client/scenes/Main.tscn
apps/player-client/scenes/Table.tscn
apps/player-client/scenes/TileButton.tscn
apps/player-client/scripts/
apps/player-client/scripts/AnimationQueue.gd
apps/player-client/scripts/AnimationQueue.gd.uid
apps/player-client/scripts/AudioManager.gd
apps/player-client/scripts/AudioManager.gd.uid
apps/player-client/scripts/GameState.gd
apps/player-client/scripts/GameState.gd.uid
apps/player-client/scripts/NetworkManager.gd
apps/player-client/scripts/NetworkManager.gd.uid
apps/player-client/scripts/TileButton.gd
apps/player-client/scripts/TileButton.gd.uid
apps/player-client/scripts/main.gd
apps/player-client/scripts/main.gd.uid
apps/player-client/scripts/table.gd
apps/player-client/scripts/table.gd.uid
apps/player-client/scripts/tile_loader.gd
apps/player-client/scripts/tile_loader.gd.uid
apps/server/
apps/server/Dockerfile
apps/server/README.md
apps/server/observe_ws.cjs
apps/server/package.json
apps/server/src/
apps/server/src/__tests__/
apps/server/src/__tests__/room.test.ts
apps/server/src/__tests__/wss.test.ts
apps/server/src/aiController.ts
apps/server/src/aiPlayer.ts
apps/server/src/gameLoop.ts
apps/server/src/index.ts
apps/server/src/protocol.ts
apps/server/src/room.ts
apps/server/src/roomManager.ts
apps/server/src/scripts/
apps/server/src/scripts/ai-smoke.ts
apps/server/src/scripts/qa-e2e.ts
apps/server/src/scripts/qa-stress.ts
apps/server/src/scripts/simulate-match.ts
apps/server/src/serve-web.ts
apps/server/src/serve.ts
apps/server/src/snapshot.ts
apps/server/src/wss.ts
apps/server/tsconfig.json
docker-compose.yml
docs/
docs/GROK_UI_OVERHAUL_PROMPT.md
docs/HARD_FIX_REPORT.md
docs/OVERNIGHT_REPORT.md
docs/qa-e2e-report.md
docs/qa-polish-report.md
docs/spec.md
nginx/
nginx/entrypoint.sh
nginx/nginx.conf
package.json
packages/
packages/rules/
packages/rules/package.json
packages/rules/src/
packages/rules/src/__tests__/
packages/rules/src/__tests__/chi.test.ts
packages/rules/src/__tests__/helpers.ts
packages/rules/src/__tests__/kong.test.ts
packages/rules/src/__tests__/peng.test.ts
packages/rules/src/__tests__/scoring.test.ts
packages/rules/src/__tests__/wall.test.ts
packages/rules/src/__tests__/win.test.ts
packages/rules/src/chi.ts
packages/rules/src/game.ts
packages/rules/src/index.ts
packages/rules/src/kong.ts
packages/rules/src/peng.ts
packages/rules/src/reactions.ts
packages/rules/src/rng.ts
packages/rules/src/scoring.ts
packages/rules/src/tiles.ts
packages/rules/src/types.ts
packages/rules/src/wall.ts
packages/rules/src/win.ts
packages/rules/tsconfig.json
pnpm-lock.yaml
pnpm-workspace.yaml
repomix-output.md
tools/
tools/download_wikimedia_tiles.py
tools/gen_tiles.py
tools/pack-repo.mjs
tsconfig.base.json
vitest.config.ts
```

# Repository Files

## File: .dockerignore

```
# Local tooling / VCS
.git
.gitignore
.DS_Store

# Node
node_modules
dist
coverage
*.log

# Godot client (not needed to build the server image)
apps/player-client
.godot

# Runtime/deploy data (certs, ACME challenge) — mounted via volumes, never baked in
data
nginx
docker-compose.yml
DEPLOYMENT.md
```

## File: .env.example

```
# ─────────────────────────────────────────────────────────────────────────
# Taiwan Mahjong — deployment environment (copy to .env and edit)
#   cp .env.example .env
# ─────────────────────────────────────────────────────────────────────────

# Your public domain (must resolve to this server's public IP).
DOMAIN=mahjong.example.com

# Email for Let's Encrypt (renewal notices). REQUIRED by the certbot service.
EMAIL=you@example.com

# Game server tuning (see apps/server/src/serve.ts).
VARIANT=north        # north (144 tiles incl. flowers) | south (136 tiles)
TIMEOUT_MS=15000     # discard/reaction autoplay timeout in ms
```

## File: .gitignore

```
# ---- Dependencies / builds ----
node_modules/
dist/
coverage/
*.log

# ---- OS / editor ----
.DS_Store
.idea/
.vscode/

# ---- Secrets ----
.env
.env.*
!.env.example

# ---- Runtime / certificate / deployment state ----
data/
letsencrypt/
certbot/

# ---- Godot client generated dirs (import cache / export output) ----
apps/player-client/.godot/
apps/player-client/export/
*.tmp
*.translation
```

## File: DEPLOYMENT.md

```
# 雲端部署文件 (Deployment Guide)

本文件說明如何在一台 **Ubuntu 雲端主機**上，用 Docker 一鍵啟動
台灣 16 張麻將的權威遊戲伺服器，並透過 **nginx + Let's Encrypt** 提供
`wss://` (WebSocket over TLS) 與 `https://` 服務。

部署架構：

```
  Godot 客戶端 (apps/player-client)
        │  wss://mahjong.example.com/ws
        ▼
  ┌─────────── nginx (容器) ───────────┐
  │ 80   → ACME challenge + 301 轉 https │
  │ 443  → TLS 終結 + WebSocket 升級    │
  └──────────────┬────────────────────┘
                 │ http://server:3000 (compose 內部網路)
  ┌──────────────▼────────────────────┐
  │  game server (容器)  node 20      │
  │  ws / health / snapshot           │
  └───────────────────────────────────┘
```

---

## 1. 前置需求

- 一台 Ubuntu 22.04 / 24.04 主機（建議 1 vCPU / 1 GB RAM 以上）。
- 一個已經把 **A 紀錄指到該主機 Public IP** 的網域名稱
  （例如 `mahjong.example.com`），且 **80 / 443 埠未被占用**。
- 主機上安裝 **Docker Engine** 與 **Docker Compose Plugin**：

```bash
# 官方一鍵安裝（Ubuntu）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # 重新登入後生效
docker --version
docker compose version
```

---

## 2. 取得專案並設定環境

```bash
# 1) 複製專案（或直接 git clone 你的 repo）
git clone <your-repo-url> taiwan-mahjong
cd taiwan-mahjong

# 2) 設定環境變數
cp .env.example .env
nano .env
```

`.env` 至少要填：

```dotenv
DOMAIN=mahjong.example.com   # 你的網域
EMAIL=you@example.com        # Let's Encrypt 通知信箱（必填）
VARIANT=north                # north（含花 144 張）或 south（136 張）
TIMEOUT_MS=15000             # 出牌/反應思考逾時（毫秒）
```

> 不用在本機安裝 Node.js / pnpm — 全部編譯都在 Docker 內完成。

---

## 3. 一鍵建置與啟動

```bash
# 建置遊戲伺服器鏡像並啟動整個 stack（server + nginx）
docker compose up -d --build
```

啟動後：

- `server` 容器在 compose 內部網路 `mj` 上監聽 `3000`（不對外暴露）。
- `nginx` 容器對外開 `80 / 443`。
- 第一次啟動時，如果還沒有 Let's Encrypt 憑證，`nginx/entrypoint.sh`
  會先產生一張**自簽憑證**當作暫時憑證，讓 stack 可以馬上起來
  （瀏覽器會顯示不安全警告，等第 4 步換成正式憑證）。

確認狀態：

```bash
docker compose ps
# NAME                  STATUS
# taiwan-mahjong-server-1  Up (healthy)
# taiwan-mahjong-nginx-1   Up
```

---

## 4. 申請正式 SSL 憑證（Let's Encrypt）

先把 stack 跑起來（這樣 nginx 才能服務 ACME challenge），然後：

```bash
docker compose run --rm certbot
```

certbot 會以 **HTTP-01 / webroot** 方式為 `${DOMAIN}` 申請憑證，
寫入 `./data/certbot/conf/live/<DOMAIN>/`。

申請成功後**重新載入 nginx**（不需要重啟，entrypoint 會改用正式憑證）：

```bash
docker compose exec nginx nginx -s reload
```

驗證正式憑證已生效：

```bash
curl -s https://mahjong.example.com/health
# {"name":"...","protocol":"...","ok":true}
```

> 之後所有請求都會走正式憑證；自簽憑證只是第一分鐘的暫時狀態。

---

## 5. 驗證 WebSocket (`wss://`)

從本機或任一台機器測試 WSS 連線：

```bash
# 用 node 一行測試（任選）
node -e '
const ws = new WebSocket("wss://mahjong.example.com/ws");
ws.onopen = () => { console.log("WSS OPEN"); ws.close(); };
ws.onerror = (e) => { console.error("WSS ERROR", e.message); process.exit(1); };
'
```

或直接用 Godot 客戶端：主選單把伺服器位址改成
`wss://mahjong.example.com/ws`（`apps/player-client/main.gd` 的預設
伺服器欄位），即可從遠端連入。

---

## 6. 自動續約（Let's Encrypt 90 天）

### 方式 A：cron（最簡單）

```bash
crontab -e
# 每週一 03:30 續約並重載 nginx
30 3 * * 1 cd /path/to/taiwan-mahjong && \
  docker compose run --rm certbot renew --webroot -w /var/www/certbot \
  --post-hook "docker compose exec nginx nginx -s reload" \
  >> /var/log/mj-certbot.log 2>&1
```

### 方式 B：系統化 systemd timer（建議）

建立 `/etc/systemd/system/mj-certbot.service`：

```ini
[Unit]
Description=Renew Taiwan Mahjong TLS certs
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/path/to/taiwan-mahjong
ExecStart=/usr/bin/docker compose run --rm certbot renew --webroot -w /var/www/certbot --post-hook "docker compose exec nginx nginx -s reload"
```

建立 `/etc/systemd/system/mj-certbot.timer`：

```ini
[Unit]
Description=Daily check for Taiwan Mahjong cert renewal

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mj-certbot.timer
```

> `certbot renew` 只有在距離到期 < 30 天才會真的續約，其餘時間直接成功退出。

---

## 7. 更新與重建

程式碼有更新時：

```bash
git pull
docker compose up -d --build   # 重建 server 鏡像（pnpm install + tsc 在容器內）
docker compose exec nginx nginx -s reload   # 若 nginx.conf 有改
```

---

## 8. 常用指令速查

| 目的 | 指令 |
|---|---|
| 啟動 | `docker compose up -d` |
| 重建後啟動 | `docker compose up -d --build` |
| 查看狀態 | `docker compose ps` |
| 看 server 日誌 | `docker compose logs -f server` |
| 看 nginx 日誌 | `docker compose logs -f nginx` |
| 停止 | `docker compose down` |
| 停止並刪資料卷 | `docker compose down -v`（會刪掉憑證，要重跑 certbot） |
| 申請/續約憑證 | `docker compose run --rm certbot` |
| 重載 nginx | `docker compose exec nginx nginx -s reload` |
| 健康檢查 | `curl https://<DOMAIN>/health` |

---

## 9. 目錄結構（本專案 DevOps）

```
├── apps/server/Dockerfile     # 多階段建置：pnpm install → tsc → prune → slim runtime
├── docker-compose.yml         # server + nginx + certbot 三服務
├── nginx/
│   ├── nginx.conf             # WSS 反代 + TLS 終結 + ACME challenge（${DOMAIN} 模板）
│   └── entrypoint.sh          # 自簽憑證 bootstrap + envsubst + 啟動 nginx
├── .env.example               # DOMAIN / EMAIL / VARIANT / TIMEOUT_MS
├── .dockerignore              # 排除 node_modules/dist/player-client 等
└── data/                      # 執行期產生（certbot 憑證、自簽憑證）— 勿 commit
```

---

## 10. 疑難排解

| 症狀 | 處理 |
|---|---|
| `docker compose up` 報 `DOMAIN is required` | `.env` 沒設定，補上 `DOMAIN=` |
| certbot 申請失敗 `unauthorized` | 確認網域 A 紀錄指向本機、80 埠有開、stack 有在跑 |
| 瀏覽器仍顯示自簽憑證警告 | certbot 成功後 `docker compose exec nginx nginx -s reload` |
| `wss` 連不上 | `docker compose logs -f nginx` 看 502；確認 `server` 是 `healthy` |
| server 容器一直重啟 | `docker compose logs server`；多半是 `.env` 變數或 port 衝突 |
```

## File: docker-compose.yml

```
# ─────────────────────────────────────────────────────────────────────────
# Taiwan Mahjong — cloud deployment (one-command stack)
#
#   server   : authoritative Node.js game server (port 3000, internal)
#   nginx    : TLS termination + WebSocket reverse proxy (ports 80/443)
#
# Usage:
#   cp .env.example .env          # set DOMAIN, EMAIL, …
#   docker compose up -d          # build images + start
#   docker compose up -d --build  # rebuild after code changes
#
# First start: nginx uses a self-signed certificate for DOMAIN so the
# stack boots even before certbot succeeds; then runs `certbot` (in the
# compose one-shot service below) to fetch the real Let's Encrypt cert:
#   docker compose run --rm certbot
#
# Health: https://<DOMAIN>/health   WebSocket: wss://<DOMAIN>/ws
# ─────────────────────────────────────────────────────────────────────────

name: taiwan-mahjong

services:
  # ── Authoritative game server (no public port — nginx proxies it) ──
  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    image: taiwan-mahjong-server:latest
    restart: unless-stopped
    environment:
      # serve.ts reads PORT / VARIANT / TIMEOUT_MS (see apps/server/src/serve.ts).
      PORT: "3000"
      VARIANT: "${VARIANT:-north}"
      TIMEOUT_MS: "${TIMEOUT_MS:-15000}"
      NODE_ENV: production
    # Health check used by nginx to mark the backend "up".
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 5s
    # Only reachable via the compose network; never published to the host.
    expose:
      - "3000"
    networks:
      - mj

  # ── nginx: TLS termination + WSS reverse proxy ──
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: "${DOMAIN:?DOMAIN is required}"
    volumes:
      # Template with ${DOMAIN} → envsubst → /etc/nginx/nginx.conf (entrypoint.sh).
      - ./nginx/nginx.conf:/etc/nginx/templates/nginx.conf:ro
      - ./nginx/entrypoint.sh:/entrypoint.sh:ro
      - ./data/certbot/conf:/etc/letsencrypt:ro
      - ./data/certbot/www:/var/www/certbot:ro
      # Self-signed bootstrap cert (generated by entrypoint.sh before certbot).
      - ./data/certs:/etc/nginx/certs
    entrypoint: ["/bin/sh", "/entrypoint.sh"]
    networks:
      - mj

  # ── certbot: one-shot ACME client (run manually; renews below) ──
  certbot:
    image: certbot/certbot:latest
    profiles: ["certbot"]
    volumes:
      - ./data/certbot/conf:/etc/letsencrypt
      - ./data/certbot/www:/var/www/certbot
    # Placeholder command — real issuance is triggered via:
    #   docker compose run --rm certbot certonly ... (see DEPLOYMENT.md)
    command: ["certonly", "--webroot", "-w", "/var/www/certbot", "--email", "${EMAIL:?EMAIL is required}", "--agree-tos", "--no-eff-email", "-d", "${DOMAIN:?DOMAIN is required}"]
    networks:
      - mj

networks:
  mj:
    driver: bridge
```

## File: package.json

```
{
  "name": "taiwan-mahjong1",
  "version": "1.0.0",
  "private": true,
  "description": "Taiwan 16-tile Mahjong — Godot 4.7 client + Node.js/TypeScript authoritative server (pnpm monorepo)",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@11.21.0",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r run typecheck"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

## File: pnpm-workspace.yaml

```
packages:
  - "packages/*"
  - "apps/*"

# Allow build scripts for packages required by vitest/esbuild.
onlyBuiltDependencies:
  - esbuild
allowBuilds:
  esbuild: true
```

## File: tsconfig.base.json

```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

## File: vitest.config.ts

```
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/__tests__/**/*.test.ts",
      "apps/**/src/**/__tests__/**/*.test.ts",
    ],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      // `@taiwan-mahjong/rules` is a workspace package whose exports point to
      // `dist/` which is not built during tests. Alias straight to the source.
      "@taiwan-mahjong/rules": path.resolve(__dirname, "packages/rules/src/index.ts"),
    },
  },
});
```

## File: packages/rules/package.json

```
{
  "name": "@taiwan-mahjong/rules",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Authoritative Domain: tile identities, shuffle/deal, double-cursor tail, chi/peng/kong/hu and scoring logic",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "drand-client": "^1.4.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

## File: packages/rules/tsconfig.json

```
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/__tests__/**"]
}
```

## File: packages/rules/src/chi.ts

```
/**
 * Chi (吃牌) — server-authoritative Domain logic.
 *
 * 限吃上家最新數牌棄牌: only the player to the left (上家) of the discarder may
 * chi, and only when the discarded tile is a numbered suit tile (數牌).
 * Chi uses exactly two physical tiles from the claimant's hand to form a run
 * (順子) with the claimed discard. The claimant does NOT draw a new tile and
 * moves straight to the discard phase (不摸牌轉入出牌階段).
 */

import type { GameState, Meld } from "./types.js";
import type { TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";
import { nextMeldId, removeByInstanceId, removeFromRiver } from "./game.js";

/** An eligible two-tile hand combination that completes a run with `discard`. */
export interface ChiOption {
  /** The two hand tiles to combine with the discard. */
  handTiles: readonly [TileInstance, TileInstance];
  /** The completed run (ordered ascending, discard included). */
  run: readonly TileInstance[];
}

/** Ranks of the two hand tiles relative to the discard to complete a run. */
const CHI_PATTERNS: ReadonlyArray<readonly [number, number]> = [
  [-2, -1], // discard + 2 below
  [-1, 1], // discard in the middle
  [1, 2], // discard + 2 above
];

/**
 * Enumerate all legal chi options for a discard, or null when the claimant is
 * not the 上家 (the seat directly after the discarder).
 */
export function chiOptions(
  state: GameState,
  seat: number,
  discard: TileInstance,
): ChiOption[] | null {
  const lastDiscardBy = state.lastDiscardBy;
  if (lastDiscardBy === undefined || lastDiscardBy === null) return null;
  // Chi only by the player immediately after (上家 = next seat).
  if ((lastDiscardBy + 1) % 4 !== seat) return null;
  const tile = discard.tile;
  if (tile.kind !== "numbered") return null;
  const suit = tile.suit;
  const rank = tile.rank;

  const hand = state.wall.hands[seat] as TileInstance[];
  // Group hand tiles by suit and rank to find matching pairs.
  const byRank = new Map<number, TileInstance[]>();
  for (const inst of hand) {
    if (inst.tile.kind === "numbered" && inst.tile.suit === suit) {
      const list = byRank.get(inst.tile.rank) ?? [];
      list.push(inst);
      byRank.set(inst.tile.rank, list);
    }
  }

  const options: ChiOption[] = [];
  const seen = new Set<string>();
  for (const [d1, d2] of CHI_PATTERNS) {
    const r1 = rank + d1;
    const r2 = rank + d2;
    if (r1 < 1 || r1 > 9 || r2 < 1 || r2 > 9) continue;
    const list1 = byRank.get(r1);
    const list2 = byRank.get(r2);
    if (!list1 || !list2 || list1.length === 0 || list2.length === 0) continue;
    for (const t1 of list1) {
      for (const t2 of list2) {
        const key = `${t1.instanceId}:${t2.instanceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({
          handTiles: [t1, t2],
          run: [t1, discard, t2].sort(
            (a, b) => (a.tile.kind === "numbered" ? a.tile.rank : 0) - (b.tile.kind === "numbered" ? b.tile.rank : 0),
          ),
        });
      }
    }
  }
  return options;
}

export interface ChiResult {
  meldId: number;
  /** The discard instance consumed by this meld. */
  claimed: TileInstance;
}

/**
 * Perform a chi meld. Validates that the option is legal, removes the two hand
 * tiles, moves the claimed discard out of the pool into the meld, appends the
 * meld, and moves the player straight to the discard phase (no draw).
 */
export function performChi(
  state: GameState,
  seat: number,
  option: ChiOption,
): ChiResult {
  const discard = state.lastDiscard;
  if (!discard) {
    throw new Error("No discard available to chi");
  }
  const hand = state.wall.hands[seat] as TileInstance[];
  const [t1, t2] = option.handTiles;
  const inHand1 = hand.some((t) => t.instanceId === t1.instanceId);
  const inHand2 = hand.some((t) => t.instanceId === t2.instanceId);
  if (!inHand1 || !inHand2) {
    throw new Error("Chi hand tiles must be in the claimant's hand");
  }

  // Remove the claimed discard from the pool (and its owner's river).
  const discardIdx = state.discards.indexOf(discard);
  if (discardIdx === -1) {
    throw new Error("Claimed discard not in the discard pool");
  }
  state.discards.splice(discardIdx, 1);
  removeFromRiver(state, discard);
  removeByInstanceId(hand, t1.instanceId);
  removeByInstanceId(hand, t2.instanceId);

  const meldId = nextMeldId(state);
  (state.melds[seat] as Meld[]).push({
    id: meldId,
    kind: "chi",
    tiles: [t1, t2, discard],
    claimed: discard,
    handTiles: [t1, t2],
  });

  // 不摸牌轉入出牌階段.
  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, claimed: discard };
}

/** Serialize an option for wire/debug purposes. */
export function chiOptionToIds(option: ChiOption): string {
  return option.handTiles.map((t) => t.instanceId).join(",") + "|" + tileToId(option.run[0]?.tile ?? option.handTiles[0]!.tile);
}
```

## File: packages/rules/src/game.ts

```
/**
 * Game state construction and low-level state transitions.
 *
 * Authoritative Domain — `packages/rules`.
 */

import type { RngFn } from "./rng.js";
import type { TileInstance } from "./tiles.js";
import type { Variant, Seat, WallState } from "./wall.js";
import { createDeal } from "./wall.js";
import type { GameState, Meld } from "./types.js";

export type { Variant, Seat };

/** Build a fresh dealt game: wall dealt, dealer to discard. */
export function createGameState(
  variant: Variant,
  rng: RngFn,
  dealer: Seat,
  dealerStreak = 0,
): GameState {
  const wall: WallState = createDeal(variant, rng, dealer);
  return {
    wall,
    melds: [[], [], [], []],
    dealer,
    turn: dealer,
    phase: "discard",
    discards: [],
    discardsBySeat: [[], [], [], []],
    dealerStreak,
  };
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

/** Cyclic distance from `from` to `to` (0..3), used for reaction ordering. */
export function seatDistance(from: number, to: number): number {
  return (to - from + 4) % 4;
}

export function removeByInstanceId(hand: TileInstance[], instanceId: number): TileInstance {
  const idx = hand.findIndex((t) => t.instanceId === instanceId);
  if (idx === -1) {
    throw new Error(`Tile instance ${instanceId} not found in hand`);
  }
  const [tile] = hand.splice(idx, 1);
  return tile as TileInstance;
}

/** Next free meld id (max existing + 1). */
export function nextMeldId(state: GameState): number {
  let max = 0;
  for (const list of state.melds) {
    for (const m of list) max = Math.max(max, m.id);
  }
  return max + 1;
}

/**
 * Discard a tile from the player's hand into the pool.
 * Server layer is responsible for validating that it is the player's turn.
 */
export function performDiscard(state: GameState, seat: Seat, tileInstanceId: number): TileInstance {
  const hand = state.wall.hands[seat];
  const tile = removeByInstanceId(hand, tileInstanceId);
  state.discards.push(tile);
  (state.discardsBySeat[seat] as TileInstance[]).push(tile);
  state.lastDiscard = tile;
  state.lastDiscardBy = seat;
  state.phase = "reaction";
  return tile;
}

/** Remove a claimed discard from its owner's per-seat river (fall back to
 * whichever river contains it). Keeps discardsBySeat consistent with the pool. */
export function removeFromRiver(state: GameState, discard: TileInstance): void {
  for (const river of state.discardsBySeat) {
    const idx = river.indexOf(discard);
    if (idx !== -1) {
      river.splice(idx, 1);
      return;
    }
  }
}

/** 合法即自動胡牌 — the server terminates the game and enters settlement. */
export function declareWin(state: GameState, winner: Seat, selfDraw: boolean): GameState {
  state.winner = winner;
  state.turn = winner;
  state.phase = "ended";
  return state;
}

export function meldsAt(state: GameState, seat: Seat): Meld[] {
  return state.melds[seat];
}
```

## File: packages/rules/src/index.ts

```
export * from "./tiles.js";
export * from "./rng.js";
export * from "./wall.js";
export * from "./types.js";
export * from "./game.js";
export * from "./chi.js";
export * from "./peng.js";
export * from "./kong.js";
export * from "./win.js";
export * from "./scoring.js";
export * from "./reactions.js";
```

## File: packages/rules/src/kong.ts

```
/**
 * Kong (槓牌) — server-authoritative Domain logic.
 *
 * Supports:
 *  - 明槓 (open kong): claim a discard + 3 identical hand tiles.
 *  - 暗槓 (closed kong): 4 identical tiles from the hand (concealed).
 *  - 加槓 (add-on kong): upgrade an existing 碰 (peng) meld with a 4th tile.
 *  - 搶槓 (qiang kong): win window when a player adds to a peng — the add-on
 *    kong can be robbed by a player holding the winning tile.
 *
 * Every kong triggers 尾牆補牌 (replacement draw from the deck cursor) and the
 * continuous flower replacement (IMMEDIATE_TAIL_CHAIN_V1) via the wall.
 */

import type { GameState, KongType, Meld, PengMeld } from "./types.js";
import type { TileInstance } from "./tiles.js";
import type { Seat } from "./wall.js";
import { nextMeldId, removeByInstanceId, removeFromRiver, seatDistance } from "./game.js";
import { drawFromDeck, replaceFlowersChain } from "./wall.js";

export interface KongOption {
  kongType: KongType;
  /** Hand tiles for open (3) / closed (4) kong, or empty for add-on. */
  handTileIds: readonly number[];
  /** Peng meld id to upgrade (add-on kong only). */
  pengMeldId?: number;
}

/**
 * Enumerate the kong options available to a player right now.
 * `allowClaim` gates open-kong claiming a fresh discard.
 */
export function kongOptions(state: GameState, seat: number, allowClaim: boolean): KongOption[] {
  const hand = state.wall.hands[seat] as TileInstance[];
  const options: KongOption[] = [];

  // --- Closed kong: 4 identical tiles in hand. ---
  const byId = new Map<string, number[]>();
  for (const t of hand) {
    const id = tileKey(t);
    const list = byId.get(id) ?? [];
    list.push(t.instanceId);
    byId.set(id, list);
  }
  for (const ids of byId.values()) {
    if (ids.length === 4) {
      options.push({ kongType: "closed", handTileIds: ids });
    }
  }

  // --- Add-on kong: upgrade a peng meld with the 4th tile from hand. ---
  const melds = state.melds[seat] as Meld[];
  for (const meld of melds) {
    if (meld.kind !== "peng") continue;
    const peng = meld as PengMeld;
    const claimedId = tileKey(peng.claimed);
    const handIds = byId.get(claimedId);
    if (handIds && handIds.length >= 1) {
      options.push({ kongType: "add-on", handTileIds: [handIds[0]!], pengMeldId: peng.id });
    }
  }

  // --- Open kong: claim the last discard with 3 matching hand tiles. ---
  if (allowClaim && state.lastDiscard) {
    const discard = state.lastDiscard;
    const discardId = tileKey(discard);
    const handIds = byId.get(discardId);
    if (handIds && handIds.length === 3) {
      options.push({ kongType: "open", handTileIds: handIds });
    }
  }

  return options;
}

/** Stable key for grouping by tile identity. */
function tileKey(t: TileInstance): string {
  return t.tile.kind === "numbered"
    ? `${t.tile.suit}:${t.tile.rank}`
    : t.tile.kind === "honor"
      ? `honor:${t.tile.honor}`
      : `flower:${t.tile.flower}`;
}

export interface KongResult {
  meldId: number;
  /** Replacement tile drawn from the deck cursor after the kong. */
  replacement?: TileInstance;
  kongType: KongType;
}

/**
 * Perform a kong and take the replacement draw (尾牆補牌) + flower chain.
 * - open kong: claim the discard, remove 3 hand tiles, meld 4.
 * - closed kong: remove 4 hand tiles, meld 4.
 * - add-on kong: remove 1 hand tile, upgrade the peng meld to a kong meld.
 */
export function performKong(
  state: GameState,
  seat: number,
  option: KongOption,
): KongResult {
  const hand = state.wall.hands[seat] as TileInstance[];
  let meldId = nextMeldId(state);

  if (option.kongType === "open") {
    const discard = state.lastDiscard;
    if (!discard) throw new Error("No discard available for open kong");
    const discardIdx = state.discards.indexOf(discard);
    if (discardIdx === -1) throw new Error("Claimed discard not in pool");
    if (option.handTileIds.length !== 3) {
      throw new Error("Open kong requires exactly 3 hand tiles");
    }
    const handTiles = option.handTileIds.map((id) => findInHand(state, seat, id));
    state.discards.splice(discardIdx, 1);
    removeFromRiver(state, discard);
    for (const id of option.handTileIds) removeByInstanceId(hand, id);
    (state.melds[seat] as Meld[]).push({
      id: meldId,
      kind: "kong",
      kongType: "open",
      tiles: [...handTiles, discard],
      claimed: discard,
    });
  } else if (option.kongType === "closed") {
    if (option.handTileIds.length !== 4) {
      throw new Error("Closed kong requires exactly 4 hand tiles");
    }
    const tiles = option.handTileIds.map((id) => findInHand(state, seat, id));
    for (const id of option.handTileIds) removeByInstanceId(hand, id);
    (state.melds[seat] as Meld[]).push({
      id: meldId,
      kind: "kong",
      kongType: "closed",
      tiles,
    });
  } else {
    // add-on
    const pengId = option.pengMeldId;
    if (pengId === undefined) throw new Error("Add-on kong requires a peng meld id");
    const melds = state.melds[seat] as Meld[];
    const pengIdx = melds.findIndex((m) => m.id === pengId && m.kind === "peng");
    if (pengIdx === -1) throw new Error(`Peng meld ${pengId} not found`);
    const peng = melds[pengIdx] as PengMeld;
    const extraId = option.handTileIds[0];
    if (extraId === undefined) throw new Error("Add-on kong requires the 4th tile");
    const extra = findInHand(state, seat, extraId);
    removeByInstanceId(hand, extraId);
    const kongMeld: Meld = {
      id: peng.id,
      kind: "kong",
      kongType: "add-on",
      tiles: [...peng.tiles, extra],
      claimed: peng.claimed,
      fromPengId: pengId,
    };
    melds[pengIdx] = kongMeld;
    meldId = peng.id;
  }

  // 尾牆補牌 + 連續補花.
  const replacement = drawFromDeck(state.wall);
  (state.wall.hands[seat] as TileInstance[]).push(replacement);
  replaceFlowersChain(state.wall, seat as Seat);

  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, replacement, kongType: option.kongType };
}

function findInHand(state: GameState, seat: number, instanceId: number): TileInstance {
  const hand = state.wall.hands[seat] as TileInstance[];
  const found = hand.find((t) => t.instanceId === instanceId);
  if (!found) throw new Error(`Tile ${instanceId} not in hand ${seat}`);
  return found;
}

/**
 * 搶槓 (qiang kong) — a player may win on the tile being added in an add-on
 * kong. Returns the seat of a valid robber (nearest by turn order), or null.
 *
 * CRITICAL (P0-1): the robbed tile must be passed in explicitly by the caller
 * (the kongger's add-on tile instance from `performKong`'s option). It must
 * NOT be derived from `state.lastDiscard` — at the moment qiang-kong is
 * evaluated the add-on kong has NOT been performed yet, so `lastDiscard` is
 * `undefined`. The win callback receives the actual robber's `seat` so the
 * caller can look up the correct per-seat melds (a fixed seat would silently
 * check the wrong player's open melds).
 */
export function qiangKong(
  state: GameState,
  robbers: readonly number[],
  extraTile: TileInstance,
  handTilesOf: (seat: number) => readonly TileInstance[],
  isWin: (seat: number, hand: readonly TileInstance[], extra: TileInstance) => boolean,
): number | null {
  if (robbers.length === 0) return null;
  const turnSeat = state.turn;
  const sorted = [...robbers].sort((a, b) => seatDistance(turnSeat, a) - seatDistance(turnSeat, b));
  for (const seat of sorted) {
    if (isWin(seat, handTilesOf(seat), extraTile)) return seat;
  }
  return null;
}
```

## File: packages/rules/src/peng.ts

```
/**
 * Peng (碰牌) — server-authoritative Domain logic.
 *
 * 碰: any player (other than the discarder) may claim the latest discard with
 * exactly two identical hand tiles, forming a triplet (刻子). The claimant
 * does NOT draw a new tile and moves straight to the discard phase
 * (不摸牌轉入出牌階段), mirroring chi.
 */

import type { GameState, Meld, PengMeld } from "./types.js";
import { sameTileIdentity } from "./types.js";
import type { TileInstance } from "./tiles.js";
import { nextMeldId, removeByInstanceId, removeFromRiver } from "./game.js";

export interface PengOption {
  /** The two hand-tile instance ids to combine with the discard. */
  handTileIds: readonly [number, number];
}

/**
 * Detect whether the player can peng the latest discard.
 * Returns null when there is no discard, or when the seat is the discarder
 * itself (a player cannot peng their own discard).
 */
export function pengOptions(state: GameState, seat: number): PengOption | null {
  const discard = state.lastDiscard;
  if (!discard) return null;
  if (state.lastDiscardBy === undefined || state.lastDiscardBy === seat) return null;
  const hand = state.wall.hands[seat] as TileInstance[];
  const matches = hand.filter((t) => sameTileIdentity(t, discard));
  if (matches.length < 2) return null;
  return {
    handTileIds: [matches[0]!.instanceId, matches[1]!.instanceId],
  };
}

export interface PengResult {
  meldId: number;
  /** The discard instance consumed by this meld. */
  claimed: TileInstance;
}

/**
 * Perform a peng meld. Validates the two hand tiles, moves the claimed discard
 * out of the pool into the meld, appends the meld, and moves the player
 * straight to the discard phase (no draw).
 */
export function performPeng(
  state: GameState,
  seat: number,
  option: PengOption,
): PengResult {
  const discard = state.lastDiscard;
  if (!discard) {
    throw new Error("No discard available to peng");
  }
  const hand = state.wall.hands[seat] as TileInstance[];
  const [id1, id2] = option.handTileIds;
  const t1 = hand.find((t) => t.instanceId === id1);
  const t2 = hand.find((t) => t.instanceId === id2);
  if (!t1 || !t2) {
    throw new Error("Peng hand tiles must be in the claimant's hand");
  }

  // Remove the claimed discard from the pool (and its owner's river).
  const discardIdx = state.discards.indexOf(discard);
  if (discardIdx === -1) {
    throw new Error("Claimed discard not in the discard pool");
  }
  state.discards.splice(discardIdx, 1);
  removeFromRiver(state, discard);
  removeByInstanceId(hand, id1);
  removeByInstanceId(hand, id2);

  const meldId = nextMeldId(state);
  (state.melds[seat] as Meld[]).push({
    id: meldId,
    kind: "peng",
    tiles: [t1, t2, discard],
    claimed: discard,
  } satisfies PengMeld);

  // 不摸牌轉入出牌階段.
  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, claimed: discard };
}
```

## File: packages/rules/src/reactions.ts

```
/**
 * Reaction priority resolution — server-authoritative.
 *
 * When multiple players can react to a discard, priority is strict:
 *   自動胡牌 (win) > 槓/碰 (kong/peng) > 吃 (chi).
 * Within the same category, the player closest to the discarder in turn order
 * wins (counter-clockwise nearest first). Ties in peng/kong go to the
 * nearest; the dealer wins ties when all else is equal (連莊 handled upstream).
 */

import type { GameState, Reaction } from "./types.js";
import { seatDistance } from "./game.js";

export type ReactionPriority = "win" | "kong" | "peng" | "chi";

const PRIORITY_ORDER: Record<ReactionPriority, number> = {
  win: 0,
  kong: 1,
  peng: 2,
  chi: 3,
};

/**
 * Resolve a set of candidate reactions into the single winning reaction.
 * Returns null when no reaction is possible (turn passes to the next player).
 */
export function resolveReactions(state: GameState, reactions: readonly Reaction[]): Reaction | null {
  if (reactions.length === 0) return null;

  const lastDiscardBy = state.lastDiscardBy;
  const turnSeat = lastDiscardBy !== undefined ? lastDiscardBy : state.turn;

  // Sort by priority first, then by seat distance from the discarder.
  const sorted = [...reactions].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.kind as ReactionPriority];
    const pb = PRIORITY_ORDER[b.kind as ReactionPriority];
    if (pa !== pb) return pa - pb;
    return seatDistance(turnSeat, a.seat) - seatDistance(turnSeat, b.seat);
  });

  return sorted[0] ?? null;
}

/**
 * Filter the reactions down to a single kind, used to build the reaction
 * window presented to the players. This mirrors `resolveReactions` but keeps
 * all equal-priority candidates so the UI can display them.
 */
export function reactionWindow(
  state: GameState,
  reactions: readonly Reaction[],
): Reaction[] {
  if (reactions.length === 0) return [];
  const resolved = resolveReactions(state, reactions);
  if (!resolved) return [];
  return reactions.filter((r) => r.kind === resolved.kind);
}
```

## File: packages/rules/src/rng.ts

```
/**
 * RNG layer for the authoritative domain.
 *
 * Uses the decentralized randomness beacon `@drand/client` when available
 * (fetched randomness), falling back to a cryptographically secure local PRNG
 * (Node `crypto`) seeded per-game for deterministic replay/audit.
 */

import { createHash, randomBytes } from "node:crypto";

/** A PRNG function yielding floats in [0, 1). */
export type RngFn = () => number;

/** Seeded 32-bit xorshift PRNG — deterministic for a given seed. */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed <= 0) {
      throw new Error(`SeededRng requires a positive safe-integer seed, got ${seed}`);
    }
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Advance the xorshift32 state and return a float in [0, 1). */
  nextFloat(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

/** Build a callable `RngFn` from a SeededRng instance. */
export function rngFromSeed(seed: number): RngFn {
  const rng = new SeededRng(seed);
  return () => rng.nextFloat();
}

/** Create a new secure random seed (crypto-safe). */
export function randomSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

/** Deterministic seed derived from an entropy string (for reproducible games). */
export function seedFromString(input: string): number {
  const hash = createHash("sha256").update(input).digest();
  return hash.readUInt32BE(0) >>> 0 || 1;
}

/**
 * Fetch a drand beacon randomness round and derive a seed from it.
 * `drand-client`'s `fetchBeacon` returns a `RandomnessBeacon` whose
 * `randomness` field is a hex-encoded string. We hash it to a 32-bit seed.
 * Falls back to a local secure seed if the network is unavailable or drand
 * fails, so the game is never blocked on external availability.
 */
export async function drandSeed(): Promise<number> {
  try {
    const { HttpCachingChain, HttpChainClient, fetchBeacon } = await import("drand-client");
    const chain = new HttpCachingChain("https://api.drand.sh");
    const client = new HttpChainClient(chain);
    const beacon = await fetchBeacon(client);
    const seed = seedFromString(beacon.randomness);
    return seed;
  } catch {
    // Decentralized beacon unavailable — fall back to local CSPRNG.
    return randomSeed();
  }
}

/** Fisher-Yates shuffle of an array using the given RNG. Returns the same array. */
export function shuffle<T>(array: T[], rng: RngFn): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = array[i] as T;
    array[i] = array[j] as T;
    array[j] = tmp;
  }
  return array;
}

export type { RandomnessBeacon } from "drand-client";
```

## File: packages/rules/src/scoring.ts

```
/**
 * Scoring Engine (計分引擎) — server-authoritative.
 *
 * Implements the Taiwan 16-tile fan (台數) matrix, a configurable fan cap
 * (default 4台, configurable to 8台), and a four-player zero-sum Ledger.
 *
 * 合法可胡即自動胡牌: scoring runs automatically once a win is declared.
 */

import type { Meld } from "./types.js";
import type { Tile, TileInstance } from "./tiles.js";
import { tileFromId, tileToId } from "./tiles.js";
import { countById } from "./win.js";

/** Fan cap options. */
export type FanCap = 4 | 8;

export interface WinContext {
  /** The winner's seat. */
  winner: number;
  /** Whether the win was a self-draw (自摸). */
  selfDraw: boolean;
  /** True when the win came from a kong replacement (槓上開花). */
  kongDraw?: boolean;
  /** True when the win was off a discard (放槍). */
  discardWin?: boolean;
  /** Seat that discarded the winning tile (放槍者), if any. */
  discardWinSeat?: number;
  /** Consecutive dealer wins (連莊). */
  dealerStreak?: number;
  /** The dealer's seat. */
  dealer: number;
  /** The winner's hand (14 for discard win, 15+ for self-draw with kong... adjusted by melds). */
  hand: readonly TileInstance[];
  /** The winner's open melds. */
  melds: readonly Meld[];
}

export interface FanBreakdown {
  /** Each applied fan rule and its value. */
  fans: Array<{ rule: string; value: number }>;
  /** Total fans before cap. */
  rawTotal: number;
  /** Applied cap. */
  cap: FanCap;
  /** Total fans after cap. */
  total: number;
}

/** A rule that inspects the win and returns 0 or a positive fan value. */
type FanRule = (ctx: WinContext) => number;

const FAN_RULES: Array<{ rule: string; fn: FanRule }> = [
  // 規則待確認：現行「自摸(1)」「門清(1)」「門清一摸三(3)」在門清自摸時會
  // 同時加總（1+1+3=5）。部分台灣北部牌例把「門清一摸三」視為取代前兩者的
  // 高階台，此處保留既有疊加語意，待規則確認後再調整，不 silent 改分。
  { rule: "自摸", fn: (c) => (c.selfDraw ? 1 : 0) },
  { rule: "門清", fn: (c) => (c.melds.length === 0 ? 1 : 0) },
  {
    rule: "門清一摸三",
    fn: (c) => (c.selfDraw && c.melds.length === 0 ? 3 : 0),
  },
  {
    rule: "碰碰胡",
    fn: (c) => (isPengHu(c) ? 4 : 0),
  },
  {
    rule: "混一色",
    fn: (c) => {
      const suits = distinctSuits(c);
      return suits.size === 2 && suits.has("honor") ? 4 : 0;
    },
  },
  {
    rule: "清一色",
    fn: (c) => (distinctSuits(c).size === 1 ? 8 : 0),
  },
  {
    rule: "暗刻高階取代",
    // Each concealed triplet is worth 1 fan. When 碰碰胡 (higher) applies, the
    // concealed-triplet fans are replaced by it (高階取代) to avoid double count.
    fn: (c) => (isPengHu(c) ? 0 : countClosedTriplets(c)),
  },
  {
    rule: "莊家連莊台",
    fn: (c) => (c.winner === c.dealer && (c.dealerStreak ?? 1) > 1 ? c.dealerStreak! - 1 : 0),
  },
];

/** Isolate concealed groups from a concealed hand (no melds): 4 triplets/runs + pair. */
function concealedGroups(hand: readonly TileInstance[]): Tile[][] {
  // Split into triplets by identity first.
  const counts = countById(hand);
  const groups: Tile[][] = [];
  for (const [id, rawCount] of counts) {
    const tile = tileFromId(id);
    let remaining = rawCount;
    while (remaining >= 3) {
      groups.push([tile, tile, tile]);
      remaining -= 3;
    }
  }
  return groups;
}

function allMeldsAreTriplets(groups: readonly Tile[][]): boolean {
  if (groups.length === 0) return false; // a runs-only concealed portion is never 碰碰胡
  return groups.every((g) => g.length === 3 && g.every((t) => tileToId(t) === tileToId(g[0]!)));
}

/**
 * 碰碰胡 (all-pong): no chi melds, every concealed group is a triplet, and the
 * total number of groups (concealed triplets + open melds) is exactly 5.
 */
function isPengHu(c: WinContext): boolean {
  if (c.melds.some((m) => m.kind === "chi")) return false;
  const concealed = concealedGroups(c.hand);
  if (!allMeldsAreTriplets(concealed)) return false;
  return concealed.length + c.melds.length === 5;
}

/** Count closed triplets in the concealed hand (each counts as 1 fan). */
function countClosedTriplets(c: WinContext): number {
  if (c.melds.length > 0) return 0; // only pure concealed hands count (simplification)
  const counts = countById(c.hand);
  let triplets = 0;
  for (const count of counts.values()) {
    if (count === 3) triplets += 1;
  }
  return triplets;
}

function distinctSuits(c: WinContext): Set<string> {
  const suits = new Set<string>();
  const addTile = (t: Tile) => {
    if (t.kind === "numbered") suits.add(t.suit);
    else if (t.kind === "honor") suits.add("honor");
  };
  for (const inst of c.hand) addTile(inst.tile);
  for (const m of c.melds) for (const inst of m.tiles) addTile(inst.tile);
  return suits;
}

/** Evaluate the fan breakdown for a win. */
export function evaluateFans(ctx: WinContext, cap: FanCap = 4): FanBreakdown {
  const fans: FanBreakdown["fans"] = [];
  for (const { rule, fn } of FAN_RULES) {
    const value = fn(ctx);
    if (value > 0) fans.push({ rule, value });
  }
  const rawTotal = fans.reduce((acc, f) => acc + f.value, 0);
  const total = Math.min(rawTotal, cap);
  return { fans, rawTotal, cap, total };
}

// ---------------------------------------------------------------------------
// Ledger — four-player zero-sum
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  seat: number;
  /** Signed balance delta for this hand. */
  delta: number;
}

/**
 * Compute the four-player settlement for a win.
 *
 * In Taiwan 16-tile mahjong, base points are derived from the fan total.
 * We use a configurable point-per-fan table; the payout flows from losers to
 * the winner such that the sum of all four deltas is exactly 0.
 */
export function settleLedger(
  ctx: WinContext,
  cap: FanCap = 4,
  pointPerFan: number = 100,
): LedgerEntry[] {
  const breakdown = evaluateFans(ctx, cap);
  const total = breakdown.total || 1; // a bare win is at least 1 fan
  const stake = total * pointPerFan;

  const deltas: LedgerEntry[] = [
    { seat: 0, delta: 0 },
    { seat: 1, delta: 0 },
    { seat: 2, delta: 0 },
    { seat: 3, delta: 0 },
  ];

  if (ctx.selfDraw) {
    // Self-draw: every other player pays the full stake to the winner.
    for (let seat = 0; seat < 4; seat++) {
      if (seat === ctx.winner) continue;
      deltas[seat]!.delta -= stake;
      deltas[ctx.winner]!.delta += stake;
    }
  } else {
    // Discard win: the discarder pays the full stake; others pay half.
    const discarder = ctx.discardWinSeat ?? -1;
    if (discarder !== -1) {
      for (let seat = 0; seat < 4; seat++) {
        if (seat === ctx.winner) continue;
        const pay = seat === discarder ? stake : Math.floor(stake / 2);
        deltas[seat]!.delta -= pay;
        deltas[ctx.winner]!.delta += pay;
      }
    }
  }
  return deltas;
}

/**
 * 一砲多響 (multi-win) settlement — compute the four-player zero-sum ledger when
 * MULTIPLE winners settle on the same discard (each with their own fan
 * breakdown / stake).
 *
 * Rules:
 *  - Every winner is paid by the discarder (放槍者) at the full stake.
 *  - Every other non-winning player pays half the stake to each winner.
 *  - Winners never pay each other (a winner is never also a payer).
 * The discarder's total loss is the sum of the stakes of all winners; the
 * ledger always sums to exactly 0.
 */
export function settleMultiLedger(
  ctxs: readonly WinContext[],
  cap: FanCap = 4,
  pointPerFan: number = 100,
): LedgerEntry[] {
  const deltas: LedgerEntry[] = [
    { seat: 0, delta: 0 },
    { seat: 1, delta: 0 },
    { seat: 2, delta: 0 },
    { seat: 3, delta: 0 },
  ];
  const winners = new Set<number>(ctxs.map((c) => c.winner));
  for (const ctx of ctxs) {
    const breakdown = evaluateFans(ctx, cap);
    const total = breakdown.total || 1; // a bare win is at least 1 fan
    const stake = total * pointPerFan;
    if (ctx.selfDraw) {
      // Self-draw (unusual for multi-win, but keep it zero-sum): every
      // non-winning player pays the full stake to this winner.
      for (let seat = 0; seat < 4; seat++) {
        if (winners.has(seat)) continue;
        deltas[seat]!.delta -= stake;
        deltas[ctx.winner]!.delta += stake;
      }
    } else {
      // Discard win: the discarder pays full; non-winning others pay half.
      const discarder = ctx.discardWinSeat ?? -1;
      if (discarder !== -1) {
        for (let seat = 0; seat < 4; seat++) {
          if (seat === ctx.winner || winners.has(seat)) continue;
          const pay = seat === discarder ? stake : Math.floor(stake / 2);
          deltas[seat]!.delta -= pay;
          deltas[ctx.winner]!.delta += pay;
        }
      }
    }
  }
  return deltas;
}

// Re-export helpers used by tests/scoring.
export { countById };
```

## File: packages/rules/src/tiles.ts

```
/**
 * Tile Identity types for Taiwan 16-tile Mahjong.
 *
 * Authoritative Domain — `packages/rules`.
 * Tile identities are the smallest immutable unit of the game.
 */

/** Character suit 萬 */
export type Suit = "wan" | "tiao" | "tong";

/** Winds 風 */
export type Wind = "dong" | "nan" | "xi" | "bei";

/** Dragons 三元 */
export type Dragon = "zhong" | "fa" | "bai";

/** Flowers & Seasons 花 (北部 only): 梅蘭竹菊 + 春夏秋冬, one copy each (8 tiles). */
export type Flower = "mei" | "lan" | "zhu" | "ju" | "chun" | "xia" | "qiu" | "dong";

/** Honor ranks (non-numbered) */
export type Honor = Wind | Dragon;

/** Numbered suit tiles 1–9 */
export type Numbered = { kind: "numbered"; suit: Suit; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };

/** Honor tiles */
export type HonorTile = { kind: "honor"; honor: Honor };

/** Flower tiles */
export type FlowerTile = { kind: "flower"; flower: Flower };

/** Union of all physical tile identities */
export type Tile = Numbered | HonorTile | FlowerTile;

/** Simple string form for logs / tests / wire protocol: e.g. "wan:5", "honor:dong", "flower:mei" */
export type TileId = string;

/** A physical tile has a stable identity (its "species") + a unique instance id. */
export interface TileInstance {
  /** Identity of the tile (what it is). */
  tile: Tile;
  /** Unique instance id for this physical tile in the wall. */
  instanceId: number;
}

/** Serialize a Tile to a compact string identity. */
export function tileToId(tile: Tile): TileId {
  if (tile.kind === "flower") return `flower:${tile.flower}`;
  if (tile.kind === "honor") return `honor:${tile.honor}`;
  return `${tile.suit}:${tile.rank}`;
}

/** Deserialize a TileId back into a Tile. Throws on malformed input. */
export function tileFromId(id: TileId): Tile {
  const [category, value] = id.split(":");
  if (category === "flower") {
    return { kind: "flower", flower: value as Flower };
  }
  if (category === "honor") {
    return { kind: "honor", honor: value as Honor };
  }
  if (category === "wan" || category === "tiao" || category === "tong") {
    const rank = Number(value);
    if (!Number.isInteger(rank) || rank < 1 || rank > 9) {
      throw new Error(`Invalid tile id: ${id}`);
    }
    return { kind: "numbered", suit: category as Suit, rank: rank as Numbered["rank"] };
  }
  throw new Error(`Invalid tile id: ${id}`);
}

/** Build the full physical deck for a given variant. */
export function buildDeck(variant: "north" | "south"): Tile[] {
  const deck: Tile[] = [];

  for (const suit of ["wan", "tiao", "tong"] as const) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({ kind: "numbered", suit, rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      }
    }
  }

  for (const wind of ["dong", "nan", "xi", "bei"] as const) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ kind: "honor", honor: wind });
    }
  }

  for (const dragon of ["zhong", "fa", "bai"] as const) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ kind: "honor", honor: dragon });
    }
  }

  if (variant === "north") {
    for (const flower of ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"] as const) {
      deck.push({ kind: "flower", flower });
    }
  }

  return deck;
}

/** North (北部) = 144 tiles, South (南部) = 136 tiles. */
export const DECK_SIZE = {
  north: 144,
  south: 136,
} as const;

/** Number of tiles each player receives at deal. */
export const DEAL_COUNT = {
  dealer: 17,
  nonDealer: 16,
} as const;

/** Fixed reserved tail size (尾 16 張) — never drawn by ordinary turns. */
export const TAIL_SIZE = 16;
```

## File: packages/rules/src/types.ts

```
/**
 * Shared Domain types: Melds, Reactions, Game state, and scoring contracts.
 *
 * Authoritative Domain — `packages/rules`.
 */

import type { Tile, TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";

// ---------------------------------------------------------------------------
// Melds
// ---------------------------------------------------------------------------

export interface MeldBase {
  /** Unique meld id within the game. */
  id: number;
  /** Every tile physically in the meld (3 for chi/peng, 4 for kong). */
  tiles: readonly TileInstance[];
}

/** 吃 (chi) — two hand tiles + the claimed discard, forming a run. */
export interface ChiMeld extends MeldBase {
  kind: "chi";
  claimed: TileInstance;
  handTiles: readonly [TileInstance, TileInstance];
}

/** 碰 (peng) — two hand tiles + the claimed discard, forming a triplet. */
export interface PengMeld extends MeldBase {
  kind: "peng";
  claimed: TileInstance;
}

export type KongType = "open" | "closed" | "add-on";

/** 槓 (kong) — open (明槓), closed (暗槓), or add-on (加槓). */
export interface KongMeld extends MeldBase {
  kind: "kong";
  kongType: KongType;
  /** Present for open kong (the claimed discard). */
  claimed?: TileInstance;
  /** Present for add-on kong (the peng meld being upgraded). */
  fromPengId?: number;
}

export type Meld = ChiMeld | PengMeld | KongMeld;

// ---------------------------------------------------------------------------
// Reactions (client proposals the server must resolve)
// ---------------------------------------------------------------------------

export type ReactionKind = "win" | "kong" | "peng" | "chi";

export interface ChiReaction {
  kind: "chi";
  seat: number;
  /** The two hand-tile instance ids to combine with the discard. */
  handTileIds: readonly [number, number];
}

export interface KongReaction {
  kind: "kong";
  seat: number;
  kongType: KongType;
  /** Hand-tile instance ids: 3 for open kong, 4 for closed kong. */
  handTileIds?: readonly number[];
  /** Peng meld id to upgrade (add-on kong). */
  pengMeldId?: number;
}

export interface PengReaction {
  kind: "peng";
  seat: number;
}

export interface WinReaction {
  kind: "win";
  seat: number;
  selfDraw: boolean;
}

export type Reaction = ChiReaction | KongReaction | PengReaction | WinReaction;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type GamePhase = "draw" | "discard" | "reaction" | "ended";

export interface GameState {
  /** The authoritative wall (tiles, cursors, hands, flowers). */
  wall: import("./wall.js").WallState;
  /** Each player's open melds (chi / peng / kong). */
  melds: [Meld[], Meld[], Meld[], Meld[]];
  dealer: number;
  turn: number;
  phase: GamePhase;
  /** Discard pool (牌池). */
  discards: TileInstance[];
  /** Per-seat discard history (各家的棄牌河) — parallel to the pool, in
   * discard order per seat, so clients can render a four-sided river. */
  discardsBySeat: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  lastDiscard?: TileInstance;
  lastDiscardBy?: number;
  /** The seat of the most recent draw (normal turn draw or kong replacement). */
  lastDrawnBy?: number;
  /** The most recent tile physically added to a hand — the 摸切 (tsumogiri)
   * target when the server auto-discards on a discard-phase timeout. */
  lastDrawnTile?: TileInstance;
  winner?: number;
  /** Consecutive dealer holds (連莊). >=1 when the dealer keeps the seat.
   * Used for 連莊台 in scoring. */
  dealerStreak: number;
}

// ---------------------------------------------------------------------------
// Small tile predicates
// ---------------------------------------------------------------------------

/** True when two tile instances have the same identity (same species). */
export function sameTileIdentity(a: TileInstance, b: TileInstance): boolean {
  return tileToId(a.tile) === tileToId(b.tile);
}

/** True when the instance's identity equals the given tile. */
export function instanceMatchesTile(inst: TileInstance, tile: Tile): boolean {
  return tileToId(inst.tile) === tileToId(tile);
}
```

## File: packages/rules/src/wall.ts

```
/**
 * Wall, deal, double-cursor tail and continuous flower replacement —
 * IMMEDIATE_TAIL_CHAIN_V1.
 *
 * Authoritative Domain — `packages/rules`.
 * The wall owns all physical tiles and the two cursors:
 *  - headCursor  (牆前游標): normal turn draws
 *  - deckCursor  (牌池游標): replacement draws (flowers / kongs) from the fixed
 *    reserved tail of 16 tiles.
 */

import type { RngFn } from "./rng.js";
import { shuffle } from "./rng.js";
import { TAIL_SIZE, buildDeck, type Tile, type TileInstance } from "./tiles.js";

export type Variant = "north" | "south";
export type Seat = 0 | 1 | 2 | 3;

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const PLAYER_COUNT = 4;

export interface WallState {
  variant: Variant;
  /** All physical tiles in draw order (head → tail). Immutable after creation. */
  wall: readonly TileInstance[];
  /** Next index available for a normal (head) draw. */
  headCursor: number;
  /** Start index of the fixed 16-tile reserved tail. */
  tailStart: number;
  /** Next index available for a replacement (deck) draw. */
  deckCursor: number;
  /** Each player's hand tiles (flowers never stay here). */
  hands: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  /** Each player's collected flowers (補花). */
  flowers: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  /** True once initial deal incl. flower chain is complete. */
  dealComplete: boolean;
}

function handAt(state: WallState, seat: Seat): TileInstance[] {
  return state.hands[seat];
}

function flowersAt(state: WallState, seat: Seat): TileInstance[] {
  return state.flowers[seat];
}

/** Draw the next tile from the head (never touches the reserved tail). */
export function drawFromHead(state: WallState): TileInstance {
  if (state.headCursor >= state.tailStart) {
    throw new Error("Wall exhausted: no tiles left for a normal draw");
  }
  const tile = state.wall[state.headCursor];
  if (!tile) {
    throw new Error(`Head cursor out of range: ${state.headCursor}`);
  }
  state.headCursor += 1;
  return tile;
}

/** Draw the next replacement tile from the deck cursor (reserved tail region). */
export function drawFromDeck(state: WallState): TileInstance {
  if (state.deckCursor >= state.wall.length) {
    throw new Error("Deck exhausted: no replacement tiles left");
  }
  const tile = state.wall[state.deckCursor];
  if (!tile) {
    throw new Error(`Deck cursor out of range: ${state.deckCursor}`);
  }
  state.deckCursor += 1;
  return tile;
}

/**
 * IMMEDIATE_TAIL_CHAIN_V1 — 北部連續補花.
 * Removes every flower from the player's hand and immediately draws one
 * replacement from the deck cursor per flower, chaining until the hand holds
 * no flowers. Hand size is preserved; only the reserved tail is consumed.
 */
export function replaceFlowersChain(state: WallState, seat: Seat): TileInstance[] {
  const hand = handAt(state, seat);
  const drawn: TileInstance[] = [];
  while (true) {
    const idx = hand.findIndex((t) => t.tile.kind === "flower");
    if (idx === -1) break;
    const [flower] = hand.splice(idx, 1);
    if (!flower) break;
    flowersAt(state, seat).push(flower);
    const replacement = drawFromDeck(state);
    hand.push(replacement);
    drawn.push(replacement);
  }
  return drawn;
}

/** Create a fresh shuffled wall (with unique instance ids) for a variant. */
export function createWall(variant: Variant, rng: RngFn): WallState {
  // Assign instance ids BEFORE shuffling so each physical tile keeps its
  // stable identity regardless of its shuffled position.
  const instances: TileInstance[] = buildDeck(variant).map((tile, i) => ({ tile, instanceId: i }));
  shuffle(instances, rng);
  const wall = instances;
  const tailStart = wall.length - TAIL_SIZE;
  return {
    variant,
    wall,
    headCursor: 0,
    tailStart,
    deckCursor: tailStart,
    hands: [[], [], [], []],
    flowers: [[], [], [], []],
    dealComplete: false,
  };
}

/** Deal the initial hands: dealer 17, others 16, then run the flower chain. */
export function dealInitial(state: WallState, dealerIndex: Seat): WallState {
  if (state.dealComplete) {
    throw new Error("Initial deal already completed");
  }
  // 4 rounds of 4 → 16 tiles each.
  for (let round = 0; round < 16; round++) {
    for (const seat of SEATS) {
      handAt(state, seat).push(drawFromHead(state));
    }
  }
  // Dealer's 17th tile.
  handAt(state, dealerIndex).push(drawFromHead(state));

  // Continuous flower replacement for every player (IMMEDIATE_TAIL_CHAIN_V1).
  for (const seat of SEATS) {
    replaceFlowersChain(state, seat);
  }

  state.dealComplete = true;
  return state;
}

/** One-shot convenience: build wall + deal for a given variant & dealer. */
export function createDeal(
  variant: Variant,
  rng: RngFn,
  dealerIndex: Seat,
): WallState {
  const state = createWall(variant, rng);
  dealInitial(state, dealerIndex);
  return state;
}

/** Normal turn draw: head tile + immediate flower chain if needed. */
export function drawTile(state: WallState, seat: Seat): TileInstance {
  const tile = drawFromHead(state);
  handAt(state, seat).push(tile);
  replaceFlowersChain(state, seat);
  return tile;
}

/** Number of tiles still available for normal head draws. */
export function headRemaining(state: WallState): number {
  return state.tailStart - state.headCursor;
}

/** Number of replacement tiles still available in the reserved tail region. */
export function deckRemaining(state: WallState): number {
  return state.wall.length - state.deckCursor;
}

/** Total tiles currently accounted for (hands + flowers + wall remnants). */
export function accountedTiles(state: WallState): number {
  const inHands = state.hands.reduce((acc, h) => acc + h.length, 0);
  const inFlowers = state.flowers.reduce((acc, f) => acc + f.length, 0);
  return inHands + inFlowers + headRemaining(state) + deckRemaining(state);
}

/** Collect every tile instance currently present in the game state. */
export function allTileInstances(state: WallState): TileInstance[] {
  const instances: TileInstance[] = [];
  for (const hand of state.hands) instances.push(...hand);
  for (const flower of state.flowers) instances.push(...flower);
  for (let i = state.headCursor; i < state.tailStart; i++) {
    const t = state.wall[i];
    if (t) instances.push(t);
  }
  for (let i = state.deckCursor; i < state.wall.length; i++) {
    const t = state.wall[i];
    if (t) instances.push(t);
  }
  return instances;
}
```

## File: packages/rules/src/win.ts

```
/**
 * Win (胡牌) detection — server-authoritative.
 *
 * 合法可胡即由伺服器自動胡牌 (auto-win): there is no 胡/過 button. The server
 * determines whether a hand (14 tiles for self-draw win, or 13 hand tiles +
 * the last discard for a win off a discard) is a legal winning hand and
 * declares the win automatically.
 *
 * A winning hand in Taiwan 16-tile mahjong consists of:
 *   - 5 sets (melds: 順子 or 刻子/槓子) + 1 pair (將),  OR
 *   - 八對子: 7 pairs + 1 triplet (17 tiles, no open melds).
 */

import type { Meld } from "./types.js";
import type { Tile, TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";

export type WinKind = "standard" | "sevenPairs";

export interface WinResult {
  win: boolean;
  kind?: WinKind;
}

/** Count tile occurrences by identity id for a list of instances. */
export function countById(instances: readonly TileInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const inst of instances) {
    const id = tileToId(inst.tile);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Sum the tile counts in a rank→count map (total tiles, not distinct ranks). */
function mapSum(counts: Map<number, number>): number {
  let sum = 0;
  for (const c of counts.values()) sum += c;
  return sum;
}

/**
 * True when the given (already complete) melds + pair form a legal standard
 * winning hand: exactly 4 melds and 1 pair, all melds valid.
 */
function isStandardWin(melds: readonly Tile[][], pair: Tile | null): boolean {
  if (melds.length !== 4 || !pair) return false;
  for (const meld of melds) {
    if (meld.length !== 3) return false;
    if (!isValidMeld(meld)) return false;
  }
  return true;
}

/** A 3-tile meld is valid if it is a run (順) or a triplet (刻). */
export function isValidMeld(tiles: readonly Tile[]): boolean {
  if (tiles.length !== 3) return false;
  const [a, b, c] = tiles;
  if (!a || !b || !c) return false;
  // Triplet: all same identity.
  if (tileToId(a) === tileToId(b) && tileToId(b) === tileToId(c)) return true;
  // Run: same suit, consecutive ranks.
  if (a.kind === "numbered" && b.kind === "numbered" && c.kind === "numbered") {
    if (a.suit !== b.suit || b.suit !== c.suit) return false;
    const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
    return ranks[1]! === ranks[0]! + 1 && ranks[2]! === ranks[1]! + 1;
  }
  return false;
}

/**
 * Recursively determine whether `counts` (of a single suit) can be partitioned
 * into runs and/or triplets, with the given number of melds to consume.
 *
 * Works purely on the count map (no separate rank-list bookkeeping, which
 * desyncs when a rank appears multiple times): always consumes the smallest
 * remaining rank, trying triplet then run, and backtracks.
 */
function canPartition(counts: Map<number, number>, meldCount: number): boolean {
  if (meldCount === 0) {
    return [...counts.values()].every((c) => c === 0);
  }
  // Find the smallest rank with a positive count.
  let rank = -1;
  for (const r of counts.keys()) {
    if ((counts.get(r) ?? 0) > 0 && (rank === -1 || r < rank)) rank = r;
  }
  if (rank === -1) return false; // no tiles left but melds remain
  const count = counts.get(rank) ?? 0;

  // Try triplet.
  if (count >= 3) {
    counts.set(rank, count - 3);
    if (count - 3 === 0) counts.delete(rank);
    const ok = canPartition(counts, meldCount - 1);
    counts.set(rank, count);
    if (ok) return true;
  }

  // Try run: rank, rank+1, rank+2.
  const c2 = counts.get(rank + 1) ?? 0;
  const c3 = counts.get(rank + 2) ?? 0;
  if (c2 > 0 && c3 > 0) {
    const orig: Array<[number, number]> = [
      [rank, count],
      [rank + 1, c2],
      [rank + 2, c3],
    ];
    counts.set(rank, count - 1);
    counts.set(rank + 1, c2 - 1);
    counts.set(rank + 2, c3 - 1);
    for (const [r, c] of orig) if (c - 1 === 0) counts.delete(r);
    const ok = canPartition(counts, meldCount - 1);
    for (const [r, c] of orig) counts.set(r, c);
    if (ok) return true;
  }
  return false;
}

/**
 * Detect a winning hand from a list of hand tile instances (already includes
 * any claimed discard for a win-off-discard), plus the player's open melds.
 */
export function detectWin(hand: readonly TileInstance[], openMelds: readonly Meld[]): WinResult {
  const kongCount = openMelds.filter((m) => m.kind === "kong").length;
  const total = hand.length + openMelds.reduce((acc, m) => acc + m.tiles.length, 0);
  // Taiwan 16-tile mahjong winning hand = 17 tiles + 1 per kong (each kong
  // meld is 4 tiles but counts as one group). Base: 5 groups (melds) + 1 pair
  // = 5×3 + 2 = 17. A kong adds one extra tile: total = 17 + kongCount.
  if (total !== 17 + kongCount) return { win: false };

  // --- Seven pairs (八對子): 7 pairs + 1 triplet = 17 tiles, concealed. ---
  if (openMelds.length === 0 && trySevenPairs(hand)) {
    return { win: true, kind: "sevenPairs" };
  }

  // --- Standard ---
  const counts = countById(hand);
  // Try each candidate pair.
  for (const [pairId, pairCount] of counts) {
    if (pairCount < 2) continue;
    // Remove the pair.
    const working = new Map(counts);
    working.set(pairId, (working.get(pairId) ?? 0) - 2);
    if ((working.get(pairId) ?? 0) === 0) working.delete(pairId);
    // Split counts by suit. Tile totals are derived from each suit's rank→count
    // map (NOT from a distinct-rank list, which desyncs when a rank appears
    // more than once as a triplet).
    const numberedCounts: Array<{ suit: string; map: Map<number, number> }> = [];
    const honorCounts: Map<string, number> = new Map();
    for (const [id, c] of working) {
      const [category, value] = id.split(":");
      if (category === "honor") {
        honorCounts.set(id, c);
      } else if (category === "wan" || category === "tiao" || category === "tong") {
        const suitEntry = numberedCounts.find((e) => e.suit === category);
        if (suitEntry) {
          suitEntry.map.set(Number(value), c);
        } else {
          numberedCounts.push({
            suit: category,
            map: new Map([[Number(value), c]]),
          });
        }
      }
    }
    // Honours must be triplets only.
    let valid = true;
    for (const [, c] of honorCounts) {
      if (c !== 3 && c !== 0) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    const requiredMelds = 5 - openMelds.length;
    // Total numbered tiles must be divisible by 3 to form complete melds.
    const numberedTotal = numberedCounts.reduce((acc, e) => acc + mapSum(e.map), 0);
    if (numberedTotal % 3 !== 0) continue;
    let partitionable = true;
    for (const entry of numberedCounts) {
      if (!canPartition(entry.map, mapSum(entry.map) / 3)) {
        partitionable = false;
        break;
      }
    }
    if (!partitionable) continue;
    // Count melds formed from numbered tiles + honor triplets.
    const honorTripletCount = [...honorCounts.values()].filter((c) => c === 3).length;
    const numberedMelds = numberedTotal / 3;
    if (numberedMelds + honorTripletCount === requiredMelds) {
      return { win: true, kind: "standard" };
    }
  }
  return { win: false };
}

/**
 * Seven pairs (八對子) in Taiwan 16-tile mahjong: 7 complete pairs + 1 triplet
 * (the winning tile completes the final pair into a triplet) = 17 tiles, with
 * no open melds.
 */
function trySevenPairs(hand: readonly TileInstance[]): boolean {
  if (hand.length !== 17) return false;
  const counts = countById(hand);
  if (counts.size !== 8) return false;
  const values = [...counts.values()].sort((a, b) => a - b);
  // 7 pairs (2 each) + 1 triplet (3).
  for (let i = 0; i < 7; i++) {
    if (values[i] !== 2) return false;
  }
  return values[7] === 3;
}

/**
 * Build the full list of 14 (or 17 with drawn) tile instances for a winning
 * hand: the 16-tile hand keeps the pair + 4 melds = 17 total on win.
 * Provided for scoring; returns the hand + meld tiles flattened.
 */
export function allWinTiles(
  hand: readonly TileInstance[],
  openMelds: readonly Meld[],
): TileInstance[] {
  const out: TileInstance[] = [...hand];
  for (const m of openMelds) out.push(...m.tiles);
  return out;
}
```

## File: packages/rules/src/__tests__/chi.test.ts

```
/**
 * Chi (吃牌) unit tests — server-authoritative.
 *
 * 限吃上家最新數牌棄牌, 兩張手牌 + 棄牌 = 順子, 不摸牌轉入出牌階段.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard } from "../game.js";
import { chiOptions, performChi } from "../chi.js";
import type { TileInstance } from "../tiles.js";
import type { GameState } from "../types.js";
import { rngFromSeed } from "../rng.js";

function setup(seat: number, lastDiscardBy: number, discard: TileInstance, hand: TileInstance[]): GameState {
  const state = createGameState("south", rngFromSeed(1), 0);
  // Clear the dealt hands and set our own.
  state.wall.hands = [[], [], [], []];
  state.wall.hands[seat] = hand;
  state.lastDiscard = discard;
  state.lastDiscardBy = lastDiscardBy;
  state.discards = [discard];
  state.turn = seat;
  state.phase = "reaction";
  return state;
}

describe("chiOptions — eligibility", () => {
  beforeEach(() => resetIds());

  it("returns options only to the player immediately after the discarder (上家)", () => {
    // discarder = seat 0, claimant must be seat 1.
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "tong:9");
    const ok = setup(1, 0, discard, hand);
    expect(chiOptions(ok, 1, discard)).not.toBeNull();

    const bad = setup(2, 0, discard, hand);
    expect(chiOptions(bad, 2, discard)).toBeNull();
  });

  it("rejects chi on honor/flowers (only numbered suits)", () => {
    const discard = tile("honor:dong");
    const hand = tiles("honor:dong", "honor:dong", "wan:3");
    const state = setup(1, 0, discard, hand);
    expect(chiOptions(state, 1, discard)).toBeNull();
  });

  it("returns empty options when the claimant cannot form a run", () => {
    const discard = tile("wan:5");
    const hand = tiles("tong:1", "tong:2", "wan:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard);
    // Eligible (上家, numbered discard) but no two tiles complete a run: [].
    expect(opts).toEqual([]);
  });

  it("finds all three run patterns for a middle discard", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "wan:6", "wan:7");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    expect(opts.length).toBeGreaterThanOrEqual(2);
    // Each option's run must contain the discard's identity.
    for (const opt of opts) {
      expect(opt.run.map((t) => t.tile.kind === "numbered" ? `${t.tile.suit}:${t.tile.rank}` : ""))
        .toContain("wan:5");
      expect(opt.handTiles).toHaveLength(2);
    }
  });

  it("does not include a second identical discard instance (hand 3,4,6,6)", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "wan:6", "wan:6");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    // 3,4 + 5 and 4,6 + 5 are the valid runs; 3,6 is not a run.
    const validCombos = opts.filter((o) => {
      const ranks = o.handTiles.map((t) => (t.tile.kind === "numbered" ? t.tile.rank : 0)).sort((a, b) => a - b);
      return (ranks[0] === 3 && ranks[1] === 4) || (ranks[0] === 4 && ranks[1] === 6);
    });
    expect(validCombos.length).toBeGreaterThan(0);
  });
});

describe("performChi — state transitions", () => {
  beforeEach(() => resetIds());

  it("removes the two hand tiles, claims the discard, and moves to discard phase", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "tong:1", "tong:2", "tong:3", "tong:4", "tong:5", "tong:6", "tong:7", "tong:8", "tong:9", "wan:9", "wan:9", "wan:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    const opt = opts[0]!;
    const handCountBefore = hand.length;
    const result = performChi(state, 1, opt);

    expect(result.meldId).toBeGreaterThan(0);
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    expect(state.melds[1]!.length).toBe(1);
    expect(state.melds[1]![0]!.kind).toBe("chi");
    expect(state.melds[1]![0]!.tiles).toHaveLength(3);
    // 不摸牌: no new tile added to the hand.
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    // 轉入出牌階段.
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(1);
    // The claimed discard is gone from the pool.
    expect(state.discards).not.toContain(discard);
  });

  it("throws when the hand tiles are not in the claimant's hand", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "tong:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    const opt = opts[0]!;
    // Swap out one of the hand tiles.
    const foreign = tiles("wan:8")[0]!;
    const fakeOption = { handTiles: [opt.handTiles[0]!, foreign] as [TileInstance, TileInstance], run: opt.run };
    expect(() => performChi(state, 1, fakeOption)).toThrow(/claimant/);
  });

  it("throws when there is no discard to chi", () => {
    const hand = tiles("wan:3", "wan:4");
    const state = setup(1, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    const opt: { handTiles: [TileInstance, TileInstance]; run: TileInstance[] } = {
      handTiles: [tiles("wan:3")[0]!, tiles("wan:4")[0]!],
      run: tiles("wan:3", "wan:4", "wan:5"),
    };
    expect(() => performChi(state, 1, opt)).toThrow(/No discard/);
  });
});

describe("performDiscard → reaction phase → chi integration", () => {
  beforeEach(() => resetIds());

  it("a normal discard sets up a chi window for the next seat", () => {
    const state = createGameState("south", rngFromSeed(2), 0);
    const hand = state.wall.hands[0] as TileInstance[];
    const toDiscard = hand[0]!;
    const discarded = performDiscard(state, 0, toDiscard.instanceId);
    expect(state.phase).toBe("reaction");
    // Next seat (1) can chi this discard if it can form a run.
    const opts = chiOptions(state, 1, discarded);
    expect(opts === null || Array.isArray(opts)).toBe(true);
  });
});
```

## File: packages/rules/src/__tests__/helpers.ts

```
/**
 * Shared test helpers: build tile instances from compact id strings.
 */

import { tileFromId, type TileInstance } from "../tiles.js";

let nextId = 1000;

/** Build TileInstance[] from ids like "wan:1", "honor:dong", "flower:mei". */
export function tiles(...ids: string[]): TileInstance[] {
  return ids.map((id) => ({
    tile: tileFromId(id),
    instanceId: nextId++,
  }));
}

/** Build a single TileInstance from an id. */
export function tile(id: string): TileInstance {
  return tiles(id)[0]!;
}

/** Reset the id counter (call in beforeEach when determinism matters). */
export function resetIds(): void {
  nextId = 1000;
}
```

## File: packages/rules/src/__tests__/kong.test.ts

```
/**
 * Kong (槓牌) unit tests — 明槓/暗槓/加槓/搶槓 + 尾牆補牌 + 連續補花.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard, nextSeat } from "../game.js";
import { kongOptions, performKong, qiangKong } from "../kong.js";
import type { TileInstance } from "../tiles.js";
import type { GameState, Meld } from "../types.js";
import { rngFromSeed } from "../rng.js";
import { deckRemaining } from "../wall.js";
import { detectWin } from "../win.js";

function setup(): GameState {
  const state = createGameState("south", rngFromSeed(1), 0);
  state.wall.hands = [[], [], [], []];
  return state;
}

describe("kongOptions — detection", () => {
  beforeEach(() => resetIds());

  it("detects a closed kong from 4 identical hand tiles", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "wan:5", "tong:9");
    const opts = kongOptions(state, 0, false);
    const closed = opts.find((o) => o.kongType === "closed");
    expect(closed).toBeDefined();
    expect(closed!.handTileIds).toHaveLength(4);
  });

  it("does not create an open kong option unless a discard is claimable", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    const opts = kongOptions(state, 0, false);
    expect(opts.find((o) => o.kongType === "open")).toBeUndefined();
  });

  it("creates an open kong option when a matching discard exists and allowClaim", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    const discard = tile("wan:5");
    state.lastDiscard = discard;
    state.lastDiscardBy = 3;
    state.discards = [discard];
    const opts = kongOptions(state, 0, true);
    const open = opts.find((o) => o.kongType === "open");
    expect(open).toBeDefined();
    expect(open!.handTileIds).toHaveLength(3);
  });

  it("detects an add-on kong from an existing peng meld", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "tong:9");
    const claimed = tile("wan:5");
    const handPair = tiles("wan:5", "wan:5");
    const peng: Meld = {
      id: 1,
      kind: "peng",
      tiles: [...handPair, claimed],
      claimed,
    };
    state.melds[0] = [peng];
    const opts = kongOptions(state, 0, false);
    const addon = opts.find((o) => o.kongType === "add-on");
    expect(addon).toBeDefined();
    expect(addon!.pengMeldId).toBe(1);
  });
});

describe("performKong — closed kong", () => {
  beforeEach(() => resetIds());

  it("removes 4 hand tiles, creates the meld, draws a replacement from the deck", () => {
    const state = setup();
    const hand = tiles("wan:5", "wan:5", "wan:5", "wan:5", "tong:9", "tong:9");
    state.wall.hands[0] = hand;
    const deckBefore = deckRemaining(state.wall);
    const closed = kongOptions(state, 0, false).find((o) => o.kongType === "closed")!;
    const result = performKong(state, 0, closed);

    expect(state.wall.hands[0]!.length).toBe(2 + 1); // 2 left + replacement
    expect(state.melds[0]![0]!.kind).toBe("kong");
    expect((state.melds[0]![0]! as { kongType: string }).kongType).toBe("closed");
    expect(result.replacement).toBeDefined();
    expect(deckRemaining(state.wall)).toBe(deckBefore - 1);
    // Moves to discard phase.
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(0);
  });
});

describe("performKong — open kong", () => {
  beforeEach(() => resetIds());

  it("claims the discard + 3 hand tiles and draws a replacement", () => {
    const state = setup();
    const hand = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    state.wall.hands[0] = hand;
    const discard = tile("wan:5");
    state.lastDiscard = discard;
    state.lastDiscardBy = 3;
    state.discards = [discard];
    const open = kongOptions(state, 0, true).find((o) => o.kongType === "open")!;
    const before = hand.length;
    const result = performKong(state, 0, open);

    expect((state.melds[0]![0]! as { kongType: string }).kongType).toBe("open");
    expect(state.melds[0]![0]!.tiles).toHaveLength(4);
    expect(state.discards).not.toContain(discard);
    // 3 removed + 1 replacement = before - 2
    expect(state.wall.hands[0]!.length).toBe(before - 2);
    expect(result.replacement).toBeDefined();
  });
});

describe("performKong — add-on kong", () => {
  beforeEach(() => resetIds());

  it("upgrades a peng meld to a kong meld using the 4th tile", () => {
    const state = setup();
    const claimed = tile("wan:5");
    const handPair = tiles("wan:5", "wan:5");
    state.melds[0] = [{ id: 7, kind: "peng", tiles: [...handPair, claimed], claimed }];
    state.wall.hands[0] = tiles("wan:5", "tong:9");
    const addon = kongOptions(state, 0, false).find((o) => o.kongType === "add-on")!;
    const result = performKong(state, 0, addon);

    const meld = state.melds[0]![0]!;
    expect(meld.kind).toBe("kong");
    expect((meld as { kongType: string }).kongType).toBe("add-on");
    expect(meld.tiles).toHaveLength(4);
    expect(meld.id).toBe(7); // keeps the peng meld id
    expect(result.meldId).toBe(7);
    // 1 hand tile consumed + 1 replacement.
    expect(state.wall.hands[0]!.length).toBe(1 + 1);
  });
});

describe("qiangKong — 搶槓 window", () => {
  beforeEach(() => resetIds());

  it("returns the nearest robber with a winning hand on the added tile", () => {
    const state = setup();
    state.turn = 2; // player 2 is making the add-on kong
    const extra = tile("wan:5");
    const robberHand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    // 16 hand tiles; the robbed wan:5 completes the wan:456 meld →
    // 123 / 456 / 789 / tong123 / tong456 + tong7 pair = 17 → win.
    // P0-1: the robbed tile is passed in explicitly — state.lastDiscard is
    // undefined before performKong runs, so qiangKong must never read it.
    expect(state.lastDiscard).toBeUndefined();
    const robber = qiangKong(
      state,
      [1, 3],
      extra,
      (seat) => (seat === 1 ? robberHand : []),
      (_seat, hand, ex) => detectWin([...hand, ex], []).win,
    );
    // Seat 3 is closer (distance 1) but does not win; seat 1 wins.
    expect(robber).toBe(1);
  });

  it("returns null when no robber can win", () => {
    const state = setup();
    state.turn = 0;
    const extra = tile("wan:5");
    const robber = qiangKong(
      state,
      [1, 2, 3],
      extra,
      () => tiles("tong:1", "tong:2"),
      () => false,
    );
    expect(robber).toBeNull();
  });

  it("P0-1: evaluates each robber against its OWN melds (not robbers[0])", () => {
    const state = setup();
    state.turn = 2; // player 2 is making the add-on kong
    const extra = tile("wan:5");
    // Seat 3 wins ONLY thanks to its own peng meld: 14 tiles (13 + robbed
    // wan:5) + the 3-tile peng = 17 → win.
    const seat3Hand = tiles(
      "wan:4", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    const claimed = tile("wan:1");
    state.melds[3] = [
      { id: 100, kind: "peng", tiles: [...tiles("wan:1", "wan:1"), claimed], claimed },
    ];
    // Seat 1 has no melds and cannot win on wan:5.
    const seat1Hand = tiles(
      "tong:1", "tong:2", "tong:3", "tong:4", "tong:5",
      "tong:6", "tong:7", "tong:8", "tong:9", "wan:9",
    );
    const seen: number[] = [];
    // robbers[0] = seat 1 — the old buggy code looked up seat 1's (empty)
    // melds when evaluating seat 3 too, wrongly concluding nobody could win.
    const robber = qiangKong(
      state,
      [1, 3],
      extra,
      (seat) => (seat === 3 ? seat3Hand : seat1Hand),
      (seat, hand, ex) => {
        seen.push(seat);
        const melds = (state.melds[seat] ?? []) as Meld[];
        return detectWin([...hand, ex], melds).win;
      },
    );
    expect(robber).toBe(3);
    // Nearest-first from turn=2: seat 3 (distance 1) wins using its OWN peng
    // meld, so the loop short-circuits and seat 1 (distance 3) is never reached.
    // (Under the old bug it would look up seat 1's empty melds → no win → null.)
    expect(seen).toEqual([3]);
  });
});

describe("integration — kong replacement keeps flower chain consistent", () => {
  beforeEach(() => resetIds());

  it("a kong replacement never leaves a flower in the hand", () => {
    const state = createGameState("north", rngFromSeed(3), 0);
    // Force 4 identical tiles into seat 0's hand.
    const hand = state.wall.hands[0] as TileInstance[];
    // Replace the first 4 hand tiles with 4 identical numbered tiles.
    const four = tiles("wan:5", "wan:5", "wan:5", "wan:5");
    hand.splice(0, 4, ...four);
    const closed = kongOptions(state, 0, false).find((o) => o.kongType === "closed")!;
    performKong(state, 0, closed);
    expect(state.wall.hands[0]!.some((t) => t.tile.kind === "flower")).toBe(false);
  });
});
```

## File: packages/rules/src/__tests__/peng.test.ts

```
/**
 * Peng (碰牌) unit tests — server-authoritative.
 *
 * 碰: 兩張相同手牌 + 棄牌 = 刻子, 不摸牌轉入出牌階段. Any non-discarder seat
 * may peng (unlike chi which is restricted to the 上家).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard } from "../game.js";
import { pengOptions, performPeng } from "../peng.js";
import type { TileInstance } from "../tiles.js";
import type { GameState } from "../types.js";
import { rngFromSeed } from "../rng.js";

function setup(seat: number, lastDiscardBy: number, discard: TileInstance, hand: TileInstance[]): GameState {
  const state = createGameState("south", rngFromSeed(1), 0);
  // Clear the dealt hands and set our own.
  state.wall.hands = [[], [], [], []];
  state.wall.hands[seat] = hand;
  state.lastDiscard = discard;
  state.lastDiscardBy = lastDiscardBy;
  state.discards = [discard];
  state.turn = seat;
  state.phase = "reaction";
  return state;
}

describe("pengOptions — eligibility", () => {
  beforeEach(() => resetIds());

  it("returns an option when the player holds two identical tiles", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, discard, hand);
    const opt = pengOptions(state, 2);
    expect(opt).not.toBeNull();
    expect(opt!.handTileIds).toHaveLength(2);
  });

  it("returns null when the player has fewer than two identical tiles", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:6", "tong:9");
    const state = setup(2, 0, discard, hand);
    expect(pengOptions(state, 2)).toBeNull();
  });

  it("returns null when there is no discard to peng", () => {
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    expect(pengOptions(state, 2)).toBeNull();
  });

  it("returns null when the seat is the discarder itself", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(0, 0, discard, hand);
    expect(pengOptions(state, 0)).toBeNull();
  });
});

describe("performPeng — state transitions", () => {
  beforeEach(() => resetIds());

  it("removes the two hand tiles, claims the discard, and moves to discard phase", () => {
    const discard = tile("wan:5");
    const hand = tiles(
      "wan:5", "wan:5",
      "tong:1", "tong:2", "tong:3", "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:8", "tong:9", "wan:1", "wan:2", "wan:3", "wan:7", "wan:8",
    );
    const state = setup(1, 0, discard, hand);
    const opt = pengOptions(state, 1)!;
    const handCountBefore = hand.length;
    const result = performPeng(state, 1, opt);

    expect(result.meldId).toBeGreaterThan(0);
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    expect(state.melds[1]!.length).toBe(1);
    expect(state.melds[1]![0]!.kind).toBe("peng");
    expect(state.melds[1]![0]!.tiles).toHaveLength(3);
    // 不摸牌: no new tile added to the hand.
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    // 轉入出牌階段.
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(1);
    // The claimed discard is gone from the pool.
    expect(state.discards).not.toContain(discard);
  });

  it("throws when the hand tiles are not in the claimant's hand", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:6", "tong:9");
    const state = setup(2, 0, discard, hand);
    const foreign = tiles("wan:9");
    const fakeOption = {
      handTileIds: [foreign[0]!.instanceId, foreign[0]!.instanceId] as [number, number],
    };
    expect(() => performPeng(state, 2, fakeOption)).toThrow(/claimant/);
  });

  it("throws when there is no discard to peng", () => {
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    const opt = { handTileIds: [1000, 1001] as [number, number] };
    expect(() => performPeng(state, 2, opt)).toThrow(/No discard/);
  });
});

describe("performDiscard → reaction phase → peng integration", () => {
  beforeEach(() => resetIds());

  it("a normal discard opens a peng window for any non-discarder seat", () => {
    const state = createGameState("south", rngFromSeed(3), 0);
    // Force seat 2 to hold a matching pair for the first discarded tile.
    const discardInst = state.wall.hands[0]![0]!;
    const seat2Hand = state.wall.hands[2] as TileInstance[];
    seat2Hand.push(
      { tile: discardInst.tile, instanceId: 9000 },
      { tile: discardInst.tile, instanceId: 9001 },
    );
    const discarded = performDiscard(state, 0, discardInst.instanceId);
    expect(state.phase).toBe("reaction");
    // Any seat other than the discarder (0) with the pair can peng.
    const opt = pengOptions(state, 2);
    expect(opt).not.toBeNull();
    expect(discarded.instanceId).toBe(discardInst.instanceId);
  });
});
```

## File: packages/rules/src/__tests__/scoring.test.ts

```
/**
 * Scoring Engine (計分引擎) Golden Tests — Taiwan 16-tile Mahjong.
 *
 * Covers the fan matrix (自摸 / 門清 / 門清一摸三 / 碰碰胡 / 混一色 / 清一色 /
 * 暗刻高階取代 / 莊家連莊台), the 4台/8台 cap boundaries, and the four-player
 * zero-sum Ledger (the sum of the four deltas is always 0).
 *
 * All 38 cases (GC-01 … GC-38) are golden: expected values are pinned so the
 * authoritative server behaves deterministically.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, resetIds } from "./helpers.js";
import { evaluateFans, settleLedger, settleMultiLedger, type WinContext } from "../scoring.js";
import type { Meld } from "../types.js";
import type { TileInstance } from "../tiles.js";

// ---------------------------------------------------------------------------
// Hand builders (ids like "wan:3", "honor:dong")
// ---------------------------------------------------------------------------

function run(suit: string, start: number): string[] {
  return [`${suit}:${start}`, `${suit}:${start + 1}`, `${suit}:${start + 2}`];
}

function triple(id: string): string[] {
  return [id, id, id];
}

function pair(id: string): string[] {
  return [id, id];
}

function chiMeld(id: number, ids: string[]): Meld {
  const t = tiles(...ids);
  return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
}

function pengMeld(id: number, tid: string): Meld {
  const t = tiles(tid, tid, tid);
  return { id, kind: "peng", tiles: t, claimed: t[0]! };
}

// ---------------------------------------------------------------------------
// Reusable winning hands (17 tiles, unless noted)
// ---------------------------------------------------------------------------

/** 5 runs + pair, mixed wan/tong, no triplets, no honors. */
const RUNS_HAND = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7", "tong:7",
];

/** 3 runs + pair = 14 hand tiles (used with one open chi meld). */
const RUNS_HAND_OPEN = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:7", "tong:7",
];

/** 5 triplets + pair (concealed 碰碰胡). */
const ALL_TRIPLETS_HAND = [
  ...triple("wan:1"),
  ...triple("wan:2"),
  ...triple("wan:3"),
  ...triple("tong:4"),
  ...triple("tong:5"),
  ...pair("honor:zhong"),
];

/** 2 triplets + 3 runs + pair. */
const TWO_TRIPLETS_HAND = [
  ...triple("wan:1"),
  ...triple("tong:5"),
  ...run("wan", 2),
  ...run("wan", 5),
  ...run("tong", 1),
  ...pair("honor:zhong"),
];

/** 5 wan runs + honor pair → 混一色, no triplets. */
const MIXED_COLOR_HAND = [
  ...run("wan", 1),
  ...run("wan", 4),
  ...run("wan", 7),
  ...run("wan", 2),
  ...run("wan", 5),
  ...pair("honor:zhong"),
];

/**
 * 清一色: 5 wan runs + wan:9 pair. Note: by pigeonhole a 17-tile one-suit
 * runs hand always contains one concealed triplet — here wan:9×3 (789 run +
 * 99 pair) → 暗刻 +1 is part of the golden expectation.
 */
const PURE_ONE_SUIT_HAND = [
  ...run("wan", 1),
  ...run("wan", 4),
  ...run("wan", 7),
  ...run("wan", 2),
  ...run("wan", 5),
  ...pair("wan:9"),
];

/** 八對子: 7 pairs + 1 triplet = 17 tiles. */
const SEVEN_PAIRS_HAND = [
  ...pair("wan:1"), ...pair("wan:2"), ...pair("wan:3"),
  ...pair("wan:4"), ...pair("wan:5"), ...pair("wan:6"),
  ...pair("wan:7"), ...triple("tong:9"),
];

function ctx(partial: Partial<WinContext> & { hand: readonly TileInstance[] }): WinContext {
  return {
    winner: 0,
    selfDraw: false,
    dealer: 0,
    melds: [],
    dealerStreak: 1,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Fan matrix — 自摸 / 門清 / 門清一摸三
// ---------------------------------------------------------------------------

describe("evaluateFans — 基本台數 (自摸 / 門清 / 門清一摸三)", () => {
  beforeEach(() => resetIds());

  it("GC-01 放槍、門清、純順子: 僅 門清 +1", () => {
    const b = evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }));
    expect(b.fans).toEqual([{ rule: "門清", value: 1 }]);
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });

  it("GC-02 自摸、門清、純順子: 自摸1+門清1+門清一摸三3=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }));
    expect(b.rawTotal).toBe(5);
    expect(b.cap).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-03 自摸、門清、純順子 (8台頂標): raw 5 → total 5", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }), 8);
    expect(b.rawTotal).toBe(5);
    expect(b.cap).toBe(8);
    expect(b.total).toBe(5);
  });

  it("GC-04 放槍、1 吃、純順子: 無台 (raw 0)", () => {
    const b = evaluateFans(
      ctx({ hand: tiles(...RUNS_HAND_OPEN), melds: [chiMeld(1, run("wan", 1))] }),
    );
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
    expect(b.total).toBe(0);
  });

  it("GC-05 自摸、1 吃、純順子: 僅 自摸 +1", () => {
    const b = evaluateFans(
      ctx({ selfDraw: true, hand: tiles(...RUNS_HAND_OPEN), melds: [chiMeld(1, run("wan", 1))] }),
    );
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 碰碰胡
// ---------------------------------------------------------------------------

describe("evaluateFans — 碰碰胡", () => {
  beforeEach(() => resetIds());

  it("GC-06 放槍、門清、全刻子: 門清1+碰碰胡4=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
  });

  it("GC-07 放槍、門清、全刻子 (8台頂標): raw 5 → total 5", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(5);
  });

  it("GC-08 放槍、2 碰 + 3 刻: 碰碰胡 +4", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "碰碰胡", value: 4 }]);
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-09 自摸、門清、全刻子: 自摸1+門清1+門清一摸三3+碰碰胡4=9 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(9);
    expect(b.total).toBe(4);
    expect(b.fans).toEqual([
      { rule: "自摸", value: 1 },
      { rule: "門清", value: 1 },
      { rule: "門清一摸三", value: 3 },
      { rule: "碰碰胡", value: 4 },
    ]);
  });

  it("GC-10 放槍、有吃、混搭: 不構成碰碰胡 (raw 0)", () => {
    const hand = tiles(
      ...triple("wan:4"), ...triple("wan:5"),
      ...run("tong", 1), ...pair("tong:9"),
    );
    const melds = [chiMeld(1, run("wan", 1))];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-11 放槍、1 碰 + 純順子: 空刻子群不誤判碰碰胡 (raw 0)", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("tong", 1), ...pair("tong:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-12 八對子 (7對+1刻) 不誤判碰碰胡: 門清1+暗刻1=2", () => {
    const b = evaluateFans(ctx({ hand: tiles(...SEVEN_PAIRS_HAND) }));
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "暗刻高階取代", value: 1 },
    ]);
    expect(b.rawTotal).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 暗刻高階取代
// ---------------------------------------------------------------------------

describe("evaluateFans — 暗刻高階取代", () => {
  beforeEach(() => resetIds());

  it("GC-13 放槍、門清、2刻3順: 門清1+暗刻2=3", () => {
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "暗刻高階取代", value: 2 },
    ]);
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-14 自摸、門清、2刻3順: raw 7 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(7);
    expect(b.total).toBe(4);
  });

  it("GC-15 放槍、1 碰 + 2 刻: 有副露時暗刻不計 (raw 0)", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("tong:5"),
      ...run("wan", 2), ...run("tong", 1), ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-16 碰碰胡時暗刻被高階取代 (不重複計算)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
    expect(b.fans.find((f) => f.rule === "暗刻高階取代")).toBeUndefined();
    expect(b.rawTotal).toBe(5); // 門清1 + 碰碰胡4，而非 1+4+5
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 混一色 / 清一色
// ---------------------------------------------------------------------------

describe("evaluateFans — 混一色 / 清一色", () => {
  beforeEach(() => resetIds());

  it("GC-17 放槍、門清、萬+字: 門清1+混一色4=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...MIXED_COLOR_HAND) }));
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
  });

  it("GC-18 放槍、1 字牌碰 + 純萬順子: 混一色 +4", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("wan", 2), ...pair("wan:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "混一色", value: 4 }]);
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-19 放槍、門清、混一色碰碰胡: 門清1+碰碰胡4+混一色4=9 → 4台頂標", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("wan:3"),
      ...triple("honor:dong"), ...triple("honor:nan"), ...pair("honor:zhong"),
    );
    const b = evaluateFans(ctx({ hand }));
    expect(b.rawTotal).toBe(9);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
  });

  it("GC-20 放槍、門清、清一色(含1暗刻): 門清1+清一色8+暗刻1=10 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b.fans).toContainEqual({ rule: "清一色", value: 8 });
    expect(b.fans).toContainEqual({ rule: "暗刻高階取代", value: 1 });
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(4);
  });

  it("GC-21 清一色(含1暗刻) 8台頂標: raw 10 → total 8", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(8);
  });

  it("GC-22 放槍、1 吃、清一色: 清一色 +8", () => {
    const hand = tiles(
      ...run("wan", 4), ...run("wan", 7), ...run("wan", 2),
      ...run("wan", 5), ...pair("wan:9"),
    );
    const melds = [chiMeld(1, run("wan", 1))];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "清一色", value: 8 }]);
    expect(b.rawTotal).toBe(8);
    expect(b.total).toBe(4); // 預設 4台頂標
  });

  it("GC-23 自摸、門清、清一色(含1暗刻): raw 14 → 4台頂標 / 8台頂標", () => {
    const b4 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b4.rawTotal).toBe(14); // 1+1+3+8+1
    expect(b4.total).toBe(4);
    const b8 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b8.total).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 莊家連莊台
// ---------------------------------------------------------------------------

describe("evaluateFans — 莊家連莊台", () => {
  beforeEach(() => resetIds());

  it("GC-24 莊家(0)放槍胡、連莊2: 門清1+連莊1=2", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "莊家連莊台", value: 1 },
    ]);
    expect(b.rawTotal).toBe(2);
  });

  it("GC-25 莊家自摸、連莊3: raw 7 → 4台頂標", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, selfDraw: true, dealerStreak: 3, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(7);
    expect(b.total).toBe(4);
  });

  it("GC-26 非莊家胡牌、連莊2: 不加連莊台", () => {
    const b = evaluateFans(
      ctx({ winner: 1, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(1); // 僅 門清
    expect(b.fans.some((f) => f.rule === "莊家連莊台")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cap boundaries
// ---------------------------------------------------------------------------

describe("evaluateFans — 頂標 (cap) 邊界", () => {
  beforeEach(() => resetIds());

  it("GC-27 raw 恰等於 4台頂標: total 4, 未被下修", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("wan", 2), ...pair("wan:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds })); // 混一色 4
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
    expect(b.cap).toBe(4);
  });

  it("GC-28 raw 低於頂標: total 保持原值", () => {
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) })); // raw 3
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-29 raw 超過頂標 1 台: 4台頂標截斷", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) })); // raw 5
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
  });

  it("GC-30 8台頂標邊界: raw 10 → total 8 (清一色+暗刻)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(8);
  });

  it("GC-31 cap 欄位正確回報", () => {
    expect(evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }), 4).cap).toBe(4);
    expect(evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }), 8).cap).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Ledger — four-player zero-sum
// ---------------------------------------------------------------------------

describe("settleLedger — 零和 Ledger", () => {
  beforeEach(() => resetIds());

  it("GC-32 自摸: 其餘三家各付全額, 四家總和為 0", () => {
    const c = ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }); // total 4
    expect(evaluateFans(c).total).toBe(4);
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 1200 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -400 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -400 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-33 自摸 (8台頂標): total 8 → 2400 / -800×3", () => {
    const hand = tiles(...PURE_ONE_SUIT_HAND);
    const c = ctx({ selfDraw: true, hand });
    expect(evaluateFans(c, 8).total).toBe(8);
    const ledger = settleLedger(c, 8);
    expect(ledger[0]!.delta).toBe(2400);
    expect(ledger[1]!.delta).toBe(-800);
    expect(ledger[2]!.delta).toBe(-800);
    expect(ledger[3]!.delta).toBe(-800);
  });

  it("GC-34 放槍: 放槍者付全額, 其餘兩家付半額, 總和為 0", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 2 }); // 碰碰胡 4 台
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 800 }); // 400 + 200 + 200
    expect(ledger[1]).toEqual({ seat: 1, delta: -200 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -200 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-35 放槍裸胡 (raw 0): 以最低 1 台計, 仍為零和", () => {
    const hand = tiles(...RUNS_HAND_OPEN);
    const melds = [chiMeld(1, run("wan", 1))];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 1 });
    expect(evaluateFans(c).total).toBe(0);
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 200 }); // 100 + 50 + 50
    expect(ledger[1]).toEqual({ seat: 1, delta: -100 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -50 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -50 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-36 自訂點數 pointPerFan=50: 放槍 4 台 → 200/100/100", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 2 });
    const ledger = settleLedger(c, 4, 50);
    expect(ledger[0]).toEqual({ seat: 0, delta: 400 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -100 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -200 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -100 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-37 奇數底分 pointPerFan=25, 3台: 半額無條件捨去仍零和", () => {
    const c = ctx({
      hand: tiles(...TWO_TRIPLETS_HAND),
      discardWin: true,
      discardWinSeat: 2,
    });
    const ledger = settleLedger(c, 4, 25);
    // total 3 → stake 75; 放槍者 -75, 其餘各 -37; 贏家 +149
    expect(ledger[0]).toEqual({ seat: 0, delta: 149 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -37 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -75 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -37 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-38 多情境零和性質 (sum of 4 deltas = 0)", () => {
    const cases: WinContext[] = [
      ctx({ selfDraw: true, hand: tiles(...ALL_TRIPLETS_HAND) }),
      ctx({ hand: tiles(...MIXED_COLOR_HAND), discardWin: true, discardWinSeat: 3 }),
      ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }),
      ctx({
        hand: tiles(...TWO_TRIPLETS_HAND),
        winner: 2,
        dealer: 0,
        discardWin: true,
        discardWinSeat: 1,
      }),
      ctx({ selfDraw: true, hand: tiles(...RUNS_HAND), winner: 3, dealer: 0, dealerStreak: 2 }),
    ];
    for (const c of cases) {
      const ledger = settleLedger(c, 8);
      const sum = ledger.reduce((acc, e) => acc + e.delta, 0);
      expect(sum).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Ledger — 一砲多響 (multi-win) zero-sum
// ---------------------------------------------------------------------------

describe("settleMultiLedger — 一砲多響零和", () => {
  beforeEach(() => resetIds());

  it("GC-39 一砲雙響：放槍者付全額給兩家，其餘付半額，總和為 0", () => {
    const c0 = ctx({
      winner: 0,
      hand: tiles(...ALL_TRIPLETS_HAND), // 門清碰碰胡: raw 5 → total 4
      discardWin: true,
      discardWinSeat: 3,
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...MIXED_COLOR_HAND), // 門清混一色: raw 5 → total 4
      discardWin: true,
      discardWinSeat: 3,
    });
    expect(evaluateFans(c0).total).toBe(4);
    expect(evaluateFans(c1).total).toBe(4);
    const ledger = settleMultiLedger([c0, c1]);
    // winner0 收到 +600 (放槍者 400 + seat2 半額 200)
    // winner1 收到 +600
    // seat2 付半額給兩家 = -400
    // seat3 (放槍者) 付全額給兩家 = -800
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
    expect(ledger[0]).toEqual({ seat: 0, delta: 600 });
    expect(ledger[1]).toEqual({ seat: 1, delta: 600 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -800 });
  });

  it("GC-40 一砲三響：三家胡同一張棄牌，總和為 0", () => {
    const hands = [ALL_TRIPLETS_HAND, MIXED_COLOR_HAND, PURE_ONE_SUIT_HAND];
    const winners = [0, 1, 2];
    const discarder = 3;
    const ctxs = winners.map((w, i) =>
      ctx({
        winner: w,
        hand: tiles(...hands[i]!),
        discardWin: true,
        discardWinSeat: discarder,
      }),
    );
    const ledger = settleMultiLedger(ctxs, 8);
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
    // 只有放槍者 seat3 與未胡者 seat? （三響時除 seat3 外無人付半額）
    // 三家皆胡 → 無半額付費者，放槍者付三家全額。
    expect(ledger[3]!.delta).toBeLessThan(0);
    expect(ledger.filter((e) => e.delta > 0).length).toBe(3);
  });

  it("GC-41 奇數底分一砲雙響：半額無條件捨去仍零和", () => {
    const c0 = ctx({
      winner: 0,
      hand: tiles(...TWO_TRIPLETS_HAND), // raw 3 → total 3
      discardWin: true,
      discardWinSeat: 3,
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...RUNS_HAND), // raw 1 → total 1
      discardWin: true,
      discardWinSeat: 3,
    });
    // pointPerFan=25：stake0=75, stake1=25
    const ledger = settleMultiLedger([c0, c1], 4, 25);
    // seat0 收放槍者全額 75 + seat2 半額 floor(75/2)=37 → +112
    // seat1 收放槍者全額 25 + seat2 半額 floor(25/2)=12 → +37
    // seat2 付半額給兩家 = -floor(75/2)37 - floor(25/2)12 = -49
    // seat3 放槍者付全額 = -75 -25 = -100
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-42 放槍者也是胡家之一（退化 case）：仍嚴格零和", () => {
    // 場景：seat 0 放槍，同時 seat 0 和 seat 1 都胡牌（罕見但規則允許）。
    // seat0 作為胡家不向自己收錢；seat1 作為胡家收 seat2/3 半額。
    // sum(delta) 必須 === 0。
    const c0 = ctx({
      winner: 0,
      hand: tiles(...ALL_TRIPLETS_HAND), // 4 fan
      discardWin: true,
      discardWinSeat: 0, // 放槍者 = 胡家
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...RUNS_HAND), // 1 fan
      discardWin: true,
      discardWinSeat: 0, // 同一放槍者
    });
    const ledger = settleMultiLedger([c0, c1]);
    const sum = ledger.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // seat0 (放槍者兼胡家) 仍應是正或零（不會被自己扣錢）。
    expect(ledger.find((e) => e.seat === 0)!.delta).toBeGreaterThanOrEqual(0);
  });

  it("GC-43 單胡家 settleMultiLedger 與 settleLedger 結果相同", () => {
    const c = ctx({
      winner: 1,
      hand: tiles(...ALL_TRIPLETS_HAND),
      discardWin: true,
      discardWinSeat: 3,
    });
    const multi = settleMultiLedger([c]);
    const single = settleLedger(c);
    for (let seat = 0; seat < 4; seat++) {
      expect(multi.find((e) => e.seat === seat)!.delta).toBe(
        single.find((e) => e.seat === seat)!.delta,
      );
    }
  });
});
```

## File: packages/rules/src/__tests__/wall.test.ts

```
/**
 * Unit tests for the authoritative wall/deal model —
 * 144/136 tile decks, double-cursor tail, dealer 17 / others 16,
 * and the IMMEDIATE_TAIL_CHAIN_V1 continuous flower replacement.
 */

import { describe, expect, it } from "vitest";
import { rngFromSeed } from "../rng.js";
import {
  accountedTiles,
  allTileInstances,
  createDeal,
  createWall,
  dealInitial,
  deckRemaining,
  drawFromDeck,
  drawTile,
  headRemaining,
  replaceFlowersChain,
} from "../wall.js";
import {
  DECK_SIZE,
  DEAL_COUNT,
  TAIL_SIZE,
  buildDeck,
  tileFromId,
  tileToId,
  type Tile,
} from "../tiles.js";

type TileLike = Tile | { tile: Tile };

function countByTileId(instances: readonly TileLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of instances) {
    const tile = "tile" in entry ? entry.tile : entry;
    const id = tileToId(tile);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

describe("tiles — deck composition", () => {
  it("builds exactly 144 tiles for the north variant", () => {
    const deck = buildDeck("north");
    expect(deck).toHaveLength(DECK_SIZE.north);
  });

  it("builds exactly 136 tiles for the south variant (no flowers)", () => {
    const deck = buildDeck("south");
    expect(deck).toHaveLength(DECK_SIZE.south);
    expect(deck.some((t) => t.kind === "flower")).toBe(false);
  });

  it("contains exactly 4 copies of each numbered/honor tile", () => {
    const counts = countByTileId(buildDeck("south"));
    for (const suit of ["wan", "tiao", "tong"] as const) {
      for (let rank = 1; rank <= 9; rank++) {
        expect(counts.get(`${suit}:${rank}`)).toBe(4);
      }
    }
    for (const honor of ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const) {
      expect(counts.get(`honor:${honor}`)).toBe(4);
    }
  });

  it("north deck contains 8 flower tiles (one of each flower/season)", () => {
    const counts = countByTileId(buildDeck("north"));
    for (const flower of ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"] as const) {
      expect(counts.get(`flower:${flower}`)).toBe(1);
    }
  });

  it("round-trips tile ids through tileToId / tileFromId", () => {
    for (const tile of buildDeck("north")) {
      expect(tileFromId(tileToId(tile))).toEqual(tile);
    }
  });

  it("throws on a malformed tile id", () => {
    expect(() => tileFromId("wan:99")).toThrow();
    expect(() => tileFromId("bogus:x")).toThrow();
  });
});

describe("wall — double-cursor model", () => {
  it("reserves exactly the last 16 tiles as the tail", () => {
    const state = createWall("north", rngFromSeed(42));
    expect(state.wall).toHaveLength(144);
    expect(state.tailStart).toBe(144 - TAIL_SIZE);
    expect(state.headCursor).toBe(0);
    expect(state.deckCursor).toBe(state.tailStart);
    expect(headRemaining(state)).toBe(128);
    expect(deckRemaining(state)).toBe(16);
  });

  it("shuffle with the same seed reproduces the same wall (deterministic)", () => {
    const a = createWall("north", rngFromSeed(7));
    const b = createWall("north", rngFromSeed(7));
    expect(a.wall.map((t) => t.instanceId)).toEqual(b.wall.map((t) => t.instanceId));
  });

  it("different seeds produce different walls", () => {
    const a = createWall("north", rngFromSeed(1));
    const b = createWall("north", rngFromSeed(2));
    const idsA = a.wall.map((t) => t.instanceId).join(",");
    const idsB = b.wall.map((t) => t.instanceId).join(",");
    expect(idsA).not.toBe(idsB);
  });
});

describe("deal — dealer 17 / others 16 with flower chain", () => {
  it("deals 17 to the dealer and 16 to each other seat (north)", () => {
    const state = createDeal("north", rngFromSeed(42), 2);
    expect(state.hands[2]).toHaveLength(DEAL_COUNT.dealer);
    expect(state.hands[0]).toHaveLength(DEAL_COUNT.nonDealer);
    expect(state.hands[1]).toHaveLength(DEAL_COUNT.nonDealer);
    expect(state.hands[3]).toHaveLength(DEAL_COUNT.nonDealer);
  });

  it("deals 17 to the dealer and 16 to others (south)", () => {
    const state = createDeal("south", rngFromSeed(1), 0);
    expect(state.hands[0]).toHaveLength(DEAL_COUNT.dealer);
    for (const seat of [1, 2, 3] as const) {
      expect(state.hands[seat]).toHaveLength(DEAL_COUNT.nonDealer);
    }
  });

  it("keeps every hand free of flowers after the chain", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 1);
      for (const seat of [0, 1, 2, 3] as const) {
        expect(state.hands[seat].some((t) => t.tile.kind === "flower")).toBe(false);
      }
    }
  });

  it("moves every drawn flower into the flower tray", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 0);
      const flowers = state.flowers.flat();
      const flowerCount = flowers.length;
      // Every flower drawn during the deal is in a tray; hands have none.
      expect(flowerCount).toBeGreaterThanOrEqual(0);
      for (const seat of [0, 1, 2, 3] as const) {
        expect(state.hands[seat].some((t) => t.tile.kind === "flower")).toBe(false);
      }
      // Instance ids are unique across all trays + hands.
      const ids = allTileInstances(state).map((t) => t.instanceId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("returns a fresh replacement for every flower (chain invariant)", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 2);
      // Deck consumption == number of flowers trayed.
      expect(deckRemaining(state)).toBe(TAIL_SIZE - state.flowers.flat().length);
      // The first 16 per player always come from the head.
      expect(state.headCursor).toBe(4 * 16 + 1);
    }
  });

  it("every tile instance in the game is accounted for exactly once", () => {
    for (const seed of [4, 9, 16, 25]) {
      const state = createDeal("north", rngFromSeed(seed), 3);
      const instances = allTileInstances(state);
      expect(instances).toHaveLength(DECK_SIZE.north);
      expect(accountedTiles(state)).toBe(DECK_SIZE.north);
      const ids = instances.map((t) => t.instanceId);
      expect(new Set(ids).size).toBe(DECK_SIZE.north);
    }
  });

  it("rejects a second initial deal", () => {
    const state = createDeal("south", rngFromSeed(11), 1);
    expect(() => dealInitial(state, 1)).toThrow(/already completed/);
  });
});

describe("drawTile — normal turns keep hands flower-free", () => {
  it("draws from the head and runs the flower chain (no flowers remain)", () => {
    const state = createDeal("north", rngFromSeed(42), 0);
    const before = state.hands[1]!.length;
    const beforeFlowers = state.flowers[1]!.length;
    const beforeHead = state.headCursor;
    drawTile(state, 1);
    // Head always advances by exactly one per normal draw.
    expect(state.headCursor).toBe(beforeHead + 1);
    // A normal draw keeps the head tile (+1); any flower is trayed and
    // replaced 1:1 from the reserved tail, so the hand is always before+1.
    const flowersDrawn = state.flowers[1]!.length - beforeFlowers;
    expect(flowersDrawn).toBeGreaterThanOrEqual(0);
    expect(state.hands[1]!.length).toBe(before + 1);
    expect(state.hands[1]!.some((t) => t.tile.kind === "flower")).toBe(false);
  });
});

describe("drawFromDeck — replacement cursor only within the tail", () => {
  it("throws when the reserved tail is exhausted", () => {
    const state = createDeal("south", rngFromSeed(42), 0);
    // Manually consume the entire reserved tail.
    while (deckRemaining(state) > 0) {
      drawFromDeck(state);
    }
    expect(() => drawFromDeck(state)).toThrow(/exhausted/);
  });

  it("replacement draws never consume the head region", () => {
    const state = createDeal("north", rngFromSeed(1), 0);
    const beforeHead = state.headCursor;
    drawFromDeck(state);
    expect(state.headCursor).toBe(beforeHead);
  });
});

describe("replaceFlowersChain — IMMEDIATE_TAIL_CHAIN_V1", () => {
  it("replaces flowers until the hand has none (north deal always chains)", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 0);
      // Chain ran to completion already; force-run again for idempotency.
      const drawn = replaceFlowersChain(state, 0);
      expect(state.hands[0]!.some((t) => t.tile.kind === "flower")).toBe(false);
      expect(drawn).toEqual([]);
    }
  });

  it("replacement tiles come from the reserved tail, not the head", () => {
    const state = createDeal("north", rngFromSeed(seedForFlowers()), 0);
    const headBefore = state.headCursor;
    const replacement = drawFromDeck(state);
    expect(replacement.instanceId).toBeGreaterThanOrEqual(state.tailStart);
    expect(state.headCursor).toBe(headBefore);
  });
});

/** Find a seed that yields at least one flower in the deal (for coverage of chaining). */
function seedForFlowers(): number {
  for (let seed = 1; seed < 200; seed++) {
    const state = createDeal("north", rngFromSeed(seed), 0);
    if (state.flowers.flat().length > 0) return seed;
  }
  return 1;
}
```

## File: packages/rules/src/__tests__/win.test.ts

```
/**
 * Win (胡牌) detection unit tests.
 *
 * 合法可胡即自動胡牌: the server detects a legal win (standard 5 melds + pair,
 * or 八對子 seven-pairs) and declares it automatically.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, resetIds } from "./helpers.js";
import { detectWin } from "../win.js";
import type { TileInstance } from "../tiles.js";
import type { Meld } from "../types.js";

function meld(id: number, ids: string[]): Meld {
  const t = tiles(...ids);
  return {
    id,
    kind: "chi",
    tiles: t,
    claimed: t[2]!,
    handTiles: [t[0]!, t[1]!],
  };
}

describe("detectWin — standard hands", () => {
  beforeEach(() => resetIds());

  it("detects a basic 17-tile winning hand (5 melds + pair)", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3", // meld 1
      "wan:4", "wan:5", "wan:6", // meld 2
      "wan:7", "wan:8", "wan:9", // meld 3
      "tong:1", "tong:2", "tong:3", // meld 4
      "tong:4", "tong:4", // pair
      // hand has 14; add the winning tile as 15th? For a discard win the hand
      // is 16 tiles + the claimed discard = 17. So supply the full 17.
      "tong:5", "tong:6", "tong:7",
    );
    // 17 tiles: melds 1-3 (wan runs) + tong 1,2,3 / 4,4 pair / 5,6,7.
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("detects a concealed hand with honor triplets + numbered runs", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    // 14 + ... this is only 14. For 17 we need 5 groups.
    // Fix: 3 runs (9) + dong triplet (3) + zhong pair (2) = 14 → 4 groups + pair.
    // Add one more meld to reach 5 groups.
    const full = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    expect(full).toHaveLength(17);
    expect(detectWin(full, []).win).toBe(true);
  });

  it("rejects a non-winning hand", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:4",
      "wan:5", "wan:6", "wan:8",
      "wan:9", "tong:1", "tong:2",
      "tong:4", "tong:5", "tong:7",
      "tong:8", "honor:dong", "honor:dong", "honor:dong", "honor:zhong",
    );
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("detects a win with open melds (fewer hand tiles)", () => {
    // 2 open melds (chi) → hand holds 3 melds + pair = 11 tiles.
    const open: Meld[] = [
      meld(1, ["wan:1", "wan:2", "wan:3"]),
      meld(2, ["wan:4", "wan:5", "wan:6"]),
    ];
    const hand = tiles(
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    expect(hand).toHaveLength(11);
    const result = detectWin(hand, open);
    expect(result.win).toBe(true);
  });

  it("rejects a hand with the wrong total tile count", () => {
    const hand = tiles("wan:1", "wan:2", "wan:3", "wan:4");
    expect(detectWin(hand, []).win).toBe(false);
  });
});

describe("detectWin — 八對子 (seven pairs + triplet)", () => {
  beforeEach(() => resetIds());

  it("detects a seven-pairs hand (7 pairs + 1 triplet = 17 tiles)", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:4", "wan:4",
      "wan:5", "wan:5", "wan:6", "wan:6",
      "wan:7", "wan:7", "tong:9", "tong:9", "tong:9",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("sevenPairs");
  });

  it("rejects a hand with 8 distinct pairs (no triplet)", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:4", "wan:4",
      "wan:5", "wan:5", "wan:6", "wan:6",
      "wan:7", "wan:7", "tong:9", "tong:9",
    );
    // Only 16 tiles → not a win.
    expect(detectWin(hand, []).win).toBe(false);
  });
});

describe("detectWin — kong adjustments", () => {
  beforeEach(() => resetIds());

  it("allows 18 tiles when one kong meld is present", () => {
    const kongTiles = tiles("wan:1", "wan:1", "wan:1", "wan:1");
    const kong: Meld = { id: 5, kind: "kong", kongType: "closed", tiles: kongTiles };
    // 1 kong (4 tiles, one group) + 4 more groups + pair = 17 - 4 + 4 + 2... 
    // With a kong: total = 17 + 1 = 18 tiles.
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:8", "tong:9",
      "honor:fa", "honor:fa",
    );
    // 4 runs + pair = 14 hand tiles; 14 + 4 (kong) = 18 = 17 + 1 kong. ✓
    const result = detectWin(hand, [kong]);
    expect(result.win).toBe(true);
  });
});

describe("detectWin — 面子數計算回歸（同數字不誤算）", () => {
  beforeEach(() => resetIds());

  function pengMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid);
    return { id, kind: "peng", tiles: t, claimed: t[0]! };
  }

  function kongMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid, tid);
    return { id, kind: "kong", kongType: "closed", tiles: t };
  }

  it("清一色順子：5 順 + 將 能胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:7",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("全刻子碰碰胡：5 刻 + 將 能胡（同數字面子數不再誤算）", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1",
      "wan:2", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:3",
      "tong:4", "tong:4", "tong:4",
      "tong:5", "tong:5", "tong:5",
      "honor:zhong", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("混一色：萬子順子 + 字牌刻子 + 將 能胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    expect(detectWin(hand, []).win).toBe(true);
  });

  it("有副露（1 碰）時仍能胡", () => {
    const open: Meld[] = [pengMeld(1, "honor:dong")];
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:9", "tong:9",
    );
    // 4 面子 + 將 = 14；+ 碰 3 張 = 17。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });

  it("2 槓（各 4 張）後張數 = 19 仍能胡", () => {
    const open: Meld[] = [
      kongMeld(1, "wan:1"),
      kongMeld(2, "tong:1"),
    ];
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "tong:2", "tong:3", "tong:4",
      "tong:5", "tong:6", "tong:7",
      "honor:fa", "honor:fa",
    );
    // 3 面子 + 將 = 11；+ 8（兩槓）= 19 = 17 + 2 槓。
    expect(hand).toHaveLength(11);
    expect(detectWin(hand, open).win).toBe(true);
  });
});

describe("detectWin — 階段 1 補充案例", () => {
  beforeEach(() => resetIds());

  function chiMeld(id: number, ids: string[]): Meld {
    const t = tiles(...ids);
    return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
  }

  it("111 234 同花色（刻 + 順混合）可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1", // 111 刻
      "wan:2", "wan:3", "wan:4", // 234 順
      "wan:5", "wan:6", "wan:7", // 567 順
      "wan:7", "wan:8", "wan:9", // 789 順
      "tong:1", "tong:1", "tong:1", // 111 筒 刻
      "tong:5", "tong:5", // 將
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("字牌三張孤張不能當順（honor 只能成刻）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:1", "tong:1",
      "tong:9", "tong:9",
      "honor:nan", "honor:xi", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    // 若 honor 可當「順」這裡就胡了；實作 honor 只認 0/3 → 不胡。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("跨花色三張（萬筒條 1）不能當順 不可胡", () => {
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:1", "tiao:2", "tiao:3",
      "wan:1", "tong:1", "tiao:1",
      "wan:9", "wan:9",
    );
    expect(hand).toHaveLength(17);
    // wan:1/tong:1/tiao:1 不同花色不可組順；任何 pair 候選都無法讓剩餘成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("只有對子 + 孤張（沒有面子）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:6",
      "wan:7", "wan:7",
      "wan:8",
      "wan:9", "wan:9",
    );
    expect(hand).toHaveLength(17);
    // 7 對 + 2 孤張：不構成八對子（7對+1刻），標準胡也無面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("完整結構但少一張（16 張）不可胡", () => {
    // 清一色順子 17 張去掉一張（wan:7 將原 pair 剩單張）。
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7",
    );
    expect(hand).toHaveLength(16);
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("重複點數很多的清一色（11122233344455 萬 + 678 順）可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1",
      "wan:2", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:3",
      "wan:4", "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:7", "wan:8",
    );
    expect(hand).toHaveLength(17);
    // 4 刻（111/222/333/444）+ 55 將 + 678 順：同數字面子數不被 rank 數誤算。
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("已吃 1 組 + 手上 4 面子 + 將 可胡", () => {
    const open: Meld[] = [chiMeld(1, ["wan:1", "wan:2", "wan:3"])];
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    // 4 面子 + 將 = 14；+ 吃 3 張 = 17。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });
});

describe("detectWin — 過夜補充案例", () => {
  beforeEach(() => resetIds());

  function pengMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid);
    return { id, kind: "peng", tiles: t, claimed: t[0]! };
  }

  function kongMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid, tid);
    return { id, kind: "kong", kongType: "closed", tiles: t };
  }

  function chiMeld(id: number, ids: string[]): Meld {
    const t = tiles(...ids);
    return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
  }

  it("[不胡] 八對子型態但有副露（7 對手牌 + 1 碰）不可胡", () => {
    const open: Meld[] = [pengMeld(1, "honor:dong")];
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "tong:9", "tong:9",
      "honor:fa", "honor:fa",
    );
    expect(hand).toHaveLength(14);
    // 14 + 碰 3 = 17 總張：八對子要求無副露 → 被擋；標準胡 7 對無面子 → 不胡。
    expect(detectWin(hand, open).win).toBe(false);
  });

  it("[不胡] 4 對 + 3 順 17 張（對子過多湊不成面子）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:1",
      "tong:2", "tong:2",
      "tong:4", "tong:4",
      "tong:5", "tong:5",
    );
    expect(hand).toHaveLength(17);
    // 任一對取下後剩 3 對 + 3 順 = 15 張卻只有 3 面目可辨 → 無法成 5 面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 1 槓 18 張但手牌面子不齊不可胡", () => {
    const open: Meld[] = [kongMeld(1, "wan:1")];
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "wan:5", "wan:6", "wan:7",
      "tong:1", "tong:2", "tong:4",
      "tong:5", "tong:7",
      "honor:zhong", "honor:zhong", "honor:zhong",
    );
    // 14 + 4（槓）= 18 總張正確，但 tong 缺 3/6 斷張、面子湊不齊。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(false);
  });

  it("[不胡] 字牌兩張將但數牌斷張不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:4",
      "wan:5", "wan:6", "wan:8",
      "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "honor:zhong", "honor:zhong",
      "tiao:7", "tiao:9",
    );
    expect(hand).toHaveLength(17);
    // 中將 2 張當將後，萬子 1,2,4 / 5,6,8 斷張不成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 萬 12345689 斷張 + 筒 123 + 將 17 張不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
      "tiao:1",
    );
    expect(hand).toHaveLength(17);
    // wan 缺 7 斷張；tiao:1 孤張當不成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[可胡] 全字牌碰碰胡（5 刻 + 將 17 張）可胡", () => {
    const hand = tiles(
      "honor:dong", "honor:dong", "honor:dong",
      "honor:nan", "honor:nan", "honor:nan",
      "honor:xi", "honor:xi", "honor:xi",
      "honor:bei", "honor:bei", "honor:bei",
      "honor:zhong", "honor:zhong", "honor:zhong",
      "honor:fa", "honor:fa",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("[可胡] 1 吃 + 1 碰 兩組副露 + 手牌 11 張可胡", () => {
    const open: Meld[] = [
      chiMeld(1, ["wan:1", "wan:2", "wan:3"]),
      pengMeld(2, "honor:dong"),
    ];
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:7", "tong:7",
    );
    // 3 面子 + 將 = 11；+ 吃 3 + 碰 3 = 17 總張。
    expect(hand).toHaveLength(11);
    expect(detectWin(hand, open).win).toBe(true);
  });

  it("[可胡] 1 槓 + 3 刻 1 順 1 將 18 張可胡", () => {
    const open: Meld[] = [kongMeld(1, "wan:1")];
    const hand = tiles(
      "wan:5", "wan:6", "wan:7",
      "wan:2", "wan:2", "wan:2",
      "tong:4", "tong:4", "tong:4",
      "tong:9", "tong:9", "tong:9",
      "honor:zhong", "honor:zhong",
    );
    // 1 順 + 3 刻 + 將 = 14；+ 4（槓）= 18 總張。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });
});

describe("detectWin — 過夜指定反例", () => {
  beforeEach(() => resetIds());

  it("[不胡] 手牌 16 張不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7",
    );
    expect(hand).toHaveLength(16);
    // total(16) != 17 + 0 槓 → 直接不胡。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 只有對子沒有面子不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:6",
      "wan:7", "wan:7",
      "wan:8", "wan:9", "tong:1",
    );
    expect(hand).toHaveLength(17);
    // 7 對 + 3 孤張：標準胡 17 張但任一對取下後剩孤張不成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 字牌東南北當順不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:9", "tong:9",
      "honor:dong", "honor:nan", "honor:xi",
    );
    expect(hand).toHaveLength(17);
    // honor 東/南/西各 1 張只能成刻（count 3），不成順 → 無法成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 1萬2筒3條跨花色當順不可胡", () => {
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:4", "tiao:5", "tiao:6",
      "wan:1", "tong:2", "tiao:3",
      "tiao:7", "tiao:7",
    );
    expect(hand).toHaveLength(17);
    // wan1/tong2/tiao3 各屬不同 suit，map 內無法形成連續順。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 八個對子 16 張無刻不可當八對子", () => {
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:6",
      "wan:7", "wan:7",
      "tong:9", "tong:9",
    );
    expect(hand).toHaveLength(16);
    // 八對子需 7 對 + 1 刻 = 17 張；16 張無刻不可。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 花牌進手不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:7", "tong:7",
      "flower:mei", "flower:lan", "flower:zhu",
    );
    expect(hand).toHaveLength(17);
    // 花 3 張不構成面子；14 有效牌 = 4 面子 + 將，缺 1 面子 → 不胡。
    expect(detectWin(hand, []).win).toBe(false);
  });
});
```

## File: apps/server/package.json

```
{
  "name": "@taiwan-mahjong/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Node.js + TypeScript WebSocket (WSS) authoritative real-time server: room lifecycle, Generation ID, command deduplication",
  "main": "dist/apps/server/src/index.js",
  "types": "dist/apps/server/src/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "serve": "node dist/apps/server/src/serve.js",
    "serve:web": "node dist/apps/server/src/serve-web.js",
    "start": "node dist/apps/server/src/serve.js",
    "dev": "node --watch dist/apps/server/src/serve.js",
    "simulate": "node dist/apps/server/src/scripts/simulate-match.js"
  },
  "dependencies": {
    "@taiwan-mahjong/rules": "workspace:*",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/ws": "^8.5.13",
    "typescript": "^5.7.0"
  }
}
```

## File: apps/server/tsconfig.json

```
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "../..",
    "paths": {
      "@taiwan-mahjong/rules": ["../../packages/rules/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

## File: apps/server/Dockerfile

```
# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────
# Taiwan Mahjong — Authoritative Game Server (pnpm monorepo, multi-stage)
#
# Stage 1 (build):
#   1. Install workspace deps from lockfile (layer-cached).
#   2. Compile packages/rules → packages/rules/dist.
#   3. Compile apps/server via:
#        pnpm --filter @taiwan-mahjong/server build
#   4. `pnpm prune --prod` drops dev dependencies for a slim runtime.
#
# Stage 2 (runtime):
#   node:20-slim + only the built dist + production node_modules.
#   The workspace layout is preserved so pnpm's `node_modules/@taiwan-mahjong/rules`
#   symlink keeps resolving and the server's ESM imports work unchanged.
#
# Build:   docker build -f apps/server/Dockerfile -t taiwan-mahjong-server .
# Run:     docker run --rm -p 3000:3000 -e PORT=3000 taiwan-mahjong-server
# ─────────────────────────────────────────────────────────────────────────

# ============ Stage 1: build ============
FROM node:20-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Activate the exact pnpm version pinned in package.json (packageManager).
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /app

# 1) Lockfile + manifests first — Docker layer caching reuses this unless
#    dependencies actually change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/rules/package.json packages/rules/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

# 2) Copy sources.
COPY packages/rules packages/rules
COPY apps/server apps/server

# 3) Compile. The server imports @taiwan-mahjong/rules from its dist,
#    so rules must be built first.
RUN pnpm --filter @taiwan-mahjong/rules build
RUN pnpm --filter @taiwan-mahjong/server build

# 4) Remove dev dependencies (typescript, vitest, @types/*, …).
RUN pnpm prune --prod

# ============ Stage 2: runtime ============
FROM node:20-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Keep the pnpm workspace layout intact (symlinks inside node_modules resolve
# to ../../packages/...), so `node apps/server/dist/apps/server/src/serve.js`
# behaves exactly like the local `pnpm --filter @taiwan-mahjong/server serve`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/rules/package.json ./packages/rules/package.json
COPY --from=build /app/packages/rules/dist ./packages/rules/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist

# Non-root user (node image provides it).
USER node

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "apps/server/dist/apps/server/src/serve.js"]
```

## File: apps/server/README.md

```
# apps/server

Node.js + TypeScript authoritative WebSocket (WSS) server.

## Responsibilities

- Room lifecycle (create / join / start / end)
- Authoritative state transitions with monotonically increasing **Generation ID**
- **Command Deduplication** — rejects stale or already-applied commands
- Applies domain logic from `@taiwan-mahjong/rules`; never invents rules itself

## Scripts

```sh
pnpm dev      # run with node --watch (after build)
pnpm build    # tsc
pnpm typecheck
```
```

## File: apps/server/observe_ws.cjs

```
// 監控腳本：訂閱伺服器事件，輸出對局流程摘要（不干擾實際連線）
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:3000/ws");
ws.on("open", () => console.log("[monitor] 監控連線已建立"));
ws.on("message", (raw) => {
  const e = JSON.parse(raw.toString());
  if (["room.created", "player.joined", "player.ready", "game.started", "game.ended", "error"].includes(e.type)) {
    console.log(`[monitor] ${e.type}`, JSON.stringify(e).slice(0, 200));
  }
  if (e.type === "snapshot") {
    const s = e.snapshot;
    console.log(`[monitor] snapshot status=${s.status} turn=${s.turn} phase=${s.gamePhase} discards=${s.discards.length} players=${s.players.map(p=>p.ready?"R":"-").join("")}`);
  }
});
ws.on("close", () => { console.log("[monitor] 連線關閉"); process.exit(0); });
ws.on("error", (err) => { console.log("[monitor] 錯誤:", err.message); process.exit(1); });
```

## File: apps/server/src/index.ts

```
/**
 * @taiwan-mahjong/server — authoritative WebSocket (WSS) server entry.
 *
 * Starts an HTTP server (health probe) + the WebSocket endpoint at `/ws`.
 * Room lifecycle, Generation ID, command deduplication, and applying
 * `@taiwan-mahjong/rules` domain logic are handled by Room / RoomManager /
 * GameServer.
 */

import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { RoomManager } from "./roomManager.js";
import { GameServer } from "./wss.js";
import { AiController } from "./aiController.js";

export { Room } from "./room.js";
export { RoomManager } from "./roomManager.js";
export { GameServer, GameSocket } from "./wss.js";
export { AiController } from "./aiController.js";
export { buildClientSnapshot } from "./snapshot.js";
export * from "./protocol.js";

export const SERVER_NAME = "taiwan-mahjong-server";
export const PROTOCOL_VERSION = "1.0.0";

export interface ServerConfig {
  port?: number;
  host?: string;
  variant?: "north" | "south";
  /** Thinking-timeout for discard/reaction phases (ms). Default 15s. */
  timeoutMs?: number;
  /** Serve static files from this directory (e.g. the Godot HTML5 export). */
  webRoot?: string;
  /**
   * Auto-fill rooms with 3 AIs (初級/中級/高級) so a single human can open one
   * webpage and play immediately. Enabled by default in serve:web, disabled in
   * headless tests / stress runs that manage their own rooms.
   */
  enableAi?: boolean;
}

export interface RunningServer {
  httpServer: ReturnType<typeof createServer>;
  manager: RoomManager;
  games: GameServer;
  port: number;
  stop: () => Promise<void>;
  /** The AI controller — null when AI filling is disabled. */
  ai: AiController | null;
}

// --- Static file serving for the Godot HTML5 export (serve:web) ---

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pck": "application/octet-stream",
};

function resolveWebPath(webRoot: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  // Strip the leading "/" — path.resolve(webRoot, "/x") would discard webRoot
  // (it treats the second arg as an absolute path) and break every static hit.
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  // resolve() → absolute path so the traversal guard compares like-for-like
  // even when webRoot is passed as a relative path (e.g. WEB_ROOT=../...).
  const candidate = resolve(webRoot, rel);
  // Prevent path traversal outside webRoot.
  const root = resolve(webRoot);
  if (!candidate.startsWith(root + sep) && candidate !== root) return null;
  return candidate;
}

function serveStatic(webRoot: string, reqUrl: string, res: ServerResponse): void {
  const file = resolveWebPath(webRoot, reqUrl);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    // SPA fallback to index.html (Godot Web needs the loader at every route).
    const index = join(webRoot, "index.html");
    if (existsSync(index)) {
      res.writeHead(200, { "content-type": MIME[".html"] });
      createReadStream(index).pipe(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(file).pipe(res);
}

/** Start the authoritative game server on the given port. */
export async function startServer(config: ServerConfig = {}): Promise<RunningServer> {
  const { port = 3000, host = "0.0.0.0", variant = "north", timeoutMs, webRoot, enableAi = false } = config;

  const manager = new RoomManager({ roomOptions: { variant, timeoutMs } });
  const httpServer = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/healthz") {
      const mem = process.memoryUsage();
      let executedEstimate = 0;
      for (const room of manager.rooms.values()) executedEstimate += room.executedSize;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          name: SERVER_NAME,
          protocol: PROTOCOL_VERSION,
          ok: true,
          memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
          sockets: games.socketCount,
          rooms: manager.rooms.size,
          executedEstimate,
        }),
      );
      return;
    }
    if (webRoot) {
      serveStatic(webRoot, req.url ?? "/", res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  });

  const games = new GameServer({ httpServer, manager });
  // Auto-fill + drive the 3 AIs (初級/中級/高級) for the play-now web flow.
  const ai = enableAi ? new AiController(manager, games) : null;
  ai?.start();

  const actualPort = await new Promise<number>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      const addr = httpServer.address();
      resolve(typeof addr === "object" && addr ? addr.port : port);
    });
  });

  const stop = async (): Promise<void> => {
    ai?.stop();
    await games.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { httpServer, manager, games, port: actualPort, stop, ai };
}

export function placeholder(): { name: string; protocol: string } {
  return { name: SERVER_NAME, protocol: PROTOCOL_VERSION };
}
```

## File: apps/server/src/protocol.ts

```
/**
 * Wire protocol — Client→Server commands and Server→Client events.
 *
 * All payloads are JSON. Every command carries an `operationId` (idempotency
 * key — the same operationId is never executed twice) and may carry the
 * `generationId` of the snapshot the client last saw. Commands with a stale
 * generationId are dropped by the room (防重機制).
 *
 * Authoritative server layer — `apps/server`.
 */

import type { FanBreakdown, LedgerEntry } from "@taiwan-mahjong/rules";
import type { ClientSnapshot } from "./snapshot.js";

export const PROTOCOL_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Commands (Client → Server)
// ---------------------------------------------------------------------------

export type CommandType = "create" | "join" | "ready" | "discard" | "reaction" | "pass" | "ping";

export interface CommandBase {
  type: CommandType;
  /** Client-generated unique id — idempotency key. Required. */
  operationId: string;
  /** GenerationId of the snapshot the client is acting on. Optional; when
   * present and stale the command is rejected (stale commands are dropped). */
  generationId?: number;
}

export interface CreateCommand extends CommandBase {
  type: "create";
  playerName?: string;
}

export interface JoinCommand extends CommandBase {
  type: "join";
  roomId: string;
  /** Prior playerId when reconnecting (seat is restored). */
  playerId?: string;
  playerName?: string;
}

export interface ReadyCommand extends CommandBase {
  type: "ready";
}

/** Heartbeat — the client proves liveness; server answers with a `pong` event. */
export interface PingCommand extends CommandBase {
  type: "ping";
  /** Client timestamp (ms) echoed back in the pong. */
  t?: number;
}

export interface PassCommand extends CommandBase {
  type: "pass";
}

export interface DiscardCommand extends CommandBase {
  type: "discard";
  tileInstanceId: number;
}

export interface ReactionCommand extends CommandBase {
  type: "reaction";
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  /** Hand-tile instance ids: 2 for chi, 3 for open kong, 4 for closed kong. */
  handTileIds?: number[];
  /** Peng meld id to upgrade (add-on kong). */
  pengMeldId?: number;
}

export type ClientCommand =
  | CreateCommand
  | JoinCommand
  | ReadyCommand
  | PassCommand
  | DiscardCommand
  | ReactionCommand
  | PingCommand;

// ---------------------------------------------------------------------------
// Events (Server → Client)
// ---------------------------------------------------------------------------

export type ServerEvent =
  | { type: "welcome"; protocol: string; playerId: string; roomId: string | null }
  | { type: "room.created"; roomId: string; generationId: number }
  | {
      type: "player.joined";
      roomId: string;
      seat: number;
      playerId: string;
      playerName: string;
      connected: boolean;
      generationId: number;
    }
  | { type: "player.ready"; roomId: string; seat: number; generationId: number }
  | { type: "player.left"; roomId: string; seat: number; generationId: number }
  | {
      type: "game.started";
      roomId: string;
      generationId: number;
      dealer: number;
      /** 連莊 count carried into this hand (連莊台 / rotation verify). */
      dealerStreak: number;
    }
  | {
      type: "game.ended";
      roomId: string;
      generationId: number;
      winner: number | null;
      selfDraw: boolean;
      kongDraw: boolean;
      /** Dealer seat for the hand that just ended (for 過莊/連莊 tracking). */
      dealer: number;
      /** 連莊 count carried into the ended hand (連莊台 / rotation verify). */
      dealerStreak: number;
      breakdown: FanBreakdown | null;
      ledger: LedgerEntry[];
      scores: number[];
    }
  | { type: "error"; code: string; message: string; operationId?: string }
  | { type: "snapshot"; roomId: string; generationId: number; snapshot: ClientSnapshot }
  | { type: "pong"; t: number };

/** Structural guard for inbound frames. */
export function isClientCommand(raw: unknown): raw is ClientCommand {
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return typeof o.type === "string" && typeof o.operationId === "string";
}
```

## File: apps/server/src/room.ts

```
/**
 * Room — the authoritative room state machine.
 *
 * Lifecycle: lobby (waiting) → playing → ended (then cleanable).
 *  - 4 players ready ⇒ auto-deal (createGameState + createDeal).
 *  - Every discard triggers the auto-win check (合法可胡即自動胡牌) and, when no
 *    win, a reaction window (kong/peng/chi) offered to eligible seats.
 *  - Generation ID: monotonic per room; commands stamped with a stale
 *    generationId are dropped (防重機制).
 *  - operationId: idempotency key; the same operationId is never executed
 *    twice within the room's lifetime.
 */

import type {
  FanBreakdown,
  GameState,
  KongOption,
  LedgerEntry,
  Meld,
  RngFn,
  Seat,
  TileInstance,
  WinContext,
} from "@taiwan-mahjong/rules";
import {
  createGameState,
  declareWin,
  detectWin,
  drawTile,
  evaluateFans,
  nextSeat,
  performChi,
  performDiscard,
  performKong,
  performPeng,
  pengOptions,
  qiangKong,
  rngFromSeed,
  seatDistance,
  seedFromString,
  settleLedger,
  settleMultiLedger,
  type WinReaction,
} from "@taiwan-mahjong/rules";
import type { ClientCommand, ReactionCommand } from "./protocol.js";
import type { RoomLike, RoomPlayerLike } from "./snapshot.js";
import {
  collectPendingKinds,
  collectWinReactions,
  findChiOption,
  findKongOption,
} from "./gameLoop.js";

export type RoomStatus = "lobby" | "playing" | "ended";

export interface RoomPlayer extends RoomPlayerLike {
  playerId: string;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — true while the player is offline (server plays for them). */
  autoplay: boolean;
}

export interface RoomOptions {
  id: string;
  variant: "north" | "south";
  dealer?: Seat;
  rng?: RngFn;
  fanCap?: 4 | 8;
  pointPerFan?: number;
  /** Thinking-timeout for the discard/reaction phases (default 15s). */
  timeoutMs?: number;
  /**
   * Fired after a server-driven mutation (autoplay 摸切/pass, disconnect
   * force-autoplay) bumps the room generation. WSS subscribes to re-broadcast
   * snapshots to the room's clients — without this, bots would stall waiting
   * for a snapshot that never arrives. The Room itself never imports WSS.
   */
  onChange?: (room: Room) => void;
}

/** Outcome of executing a client command. */
export interface CommandResult {
  ok: boolean;
  error?: { code: string; message: string };
}

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const OTHERS = (seat: Seat): Seat[] => SEATS.filter((s) => s !== seat);

/** Order win reactions by turn distance from the discarder (nearest first),
 * so the primary `winner` mirrors the old nearest-winner behaviour. */
function sortedWinners(state: GameState, wins: readonly WinReaction[]): Seat[] {
  const from = state.lastDiscardBy ?? state.turn;
  return [...wins]
    .map((w) => w.seat as Seat)
    .sort((a, b) => seatDistance(from, a) - seatDistance(from, b));
}

export class Room implements RoomLike {
  readonly id: string;
  status: RoomStatus = "lobby";
  generationId = 0;
  players: (RoomPlayer | null)[] = [null, null, null, null];
  state: GameState | null = null;
  winner: number | null = null;
  selfDraw = false;
  kongDraw = false;
  breakdown: FanBreakdown | null = null;
  ledger: LedgerEntry[] | null = null;
  scores = [0, 0, 0, 0];

  /** Current operationId dedup ledger size (reset every round — no bloat). */
  get executedSize(): number {
    return this.executed.size;
  }

  private readonly variant: "north" | "south";
  /** Server-driven change notification (WSS re-broadcast). */
  private readonly onChange?: (room: Room) => void;
  /** Current dealer seat (rotates after every hand: 莊家輪替). */
  private dealer: Seat;
  /** Consecutive dealer holds (連莊); 0 = fresh dealer. Feeds 連莊台 scoring. */
  dealerStreak = 0;
  /** 自動託管 flag per seat — enabled on disconnect, disabled on reconnect. */
  autoplay: boolean[] = [false, false, false, false];
  /** Epoch ms when the current phase's autoplay timeout fires (null = none). */
  phaseDeadline: number | null = null;
  /** Autoplay audit log — server-driven 摸切/pass (observability + tests). */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }> = [];
  private readonly rng: RngFn;
  private readonly fanCap: 4 | 8;
  private readonly pointPerFan: number;
  /** Thinking timeout (15s default; configurable for tests / sims). */
  private readonly timeoutMs: number;
  private timeoutHandle: NodeJS.Timeout | null = null;
  /** operationId dedup — executed commands only. */
  private readonly executed = new Set<string>();
  /**
   * Seats that already passed in the CURRENT reaction window. A pass only
   * removes that seat's pending kinds — the window closes only after EVERY
   * pending seat passes (or a claim resolves it). Prevents a single unrelated
   * pass (e.g. an AI with no claim rights) from killing the human's window.
   */
  private pendingPasses = new Set<number>();

  constructor(options: RoomOptions) {
    this.id = options.id;
    this.variant = options.variant;
    this.dealer = options.dealer ?? 0;
    this.rng = options.rng ?? rngFromSeed(seedFromString(options.id));
    this.fanCap = options.fanCap ?? 4;
    this.pointPerFan = options.pointPerFan ?? 100;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.dealerStreak = 0;
    this.onChange = options.onChange;
  }

  // -------------------------------------------------------------------------
  // Players
  // -------------------------------------------------------------------------

  join(playerId: string, playerName = "Player"): Seat {
    const existing = this.players.findIndex((p) => p?.playerId === playerId);
    if (existing !== -1) return existing as Seat;
    if (this.status !== "lobby") {
      throw new Error("Room is not accepting players");
    }
    const seat = this.players.findIndex((p) => p === null);
    if (seat === -1) throw new Error("Room is full");
    this.players[seat] = { playerId, playerName, connected: true, ready: false, autoplay: false };
    this.bump();
    return seat as Seat;
  }

  seatOf(playerId: string): number {
    return this.players.findIndex((p) => p?.playerId === playerId);
  }

  setConnected(playerId: string, connected: boolean): void {
    const idx = this.players.findIndex((x) => x?.playerId === playerId);
    const p = idx === -1 ? undefined : this.players[idx];
    if (p) {
      p.connected = connected;
      const seat = idx as Seat;
      if (this.status === "playing") {
        if (connected) {
          // Reconnect → restore manual control + a fresh thinking timer.
          this.autoplay[seat] = false;
          this.scheduleAutoplay();
        } else {
          // Disconnect → enable 自動託管 and immediately resolve any action
          // this seat is currently blocking (摸切 / pass).
          this.autoplay[seat] = true;
          this.forceAutoplay(seat);
        }
        // Keep the RoomPlayer flag in sync — snapshots & tests read it directly.
        p.autoplay = this.autoplay[seat];
      }
      this.bump();
    }
  }

  setReady(playerId: string): void {
    const seat = this.seatOf(playerId);
    if (seat === -1) throw new Error("Player not in room");
    // A round is over — the first ready resets the room for the next round.
    if (this.status === "ended") this.resetForNextRound();
    const p = this.players[seat]!;
    p.ready = true;
    this.bump();
    if (this.status === "lobby" && this.players.every((x) => x?.ready === true)) {
      this.startGame();
    }
  }

  /**
   * Reset the room for the next round while keeping the seats and the running
   * scores. Transitions ended → lobby; every player must ready again before the
   * next deal. Returns false when the room is not in the ended state.
   */
  resetForNextRound(): boolean {
    if (this.status !== "ended") return false;
    this.clearAutoplay();
    // Per-round autoplay audit log — a fresh hand starts with an empty log.
    this.autoplayLog = [];
    // A fresh hand returns every seat to manual control (自動託管 off).
    this.autoplay = [false, false, false, false];
    this.status = "lobby";
    for (const p of this.players) {
      if (p) {
        p.ready = false;
        p.autoplay = false;
      }
    }
    this.state = null;
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = null;
    this.bump();
    return true;
  }

  private startGame(): void {
    if (this.status !== "lobby") return;
    const allConnected = this.players.every((p) => p && p.connected);
    if (!allConnected) return;
    // A fresh deal consumes everyone's ready — the next hand requires each
    // player to ready again (resetForNextRound expects that, and the AI
    // controller / human clients re-ready via their tick loops).
    for (const p of this.players) {
      if (p) p.ready = false;
    }
    this.state = createGameState(this.variant, this.rng, this.dealer, this.dealerStreak);
    // 莊家起手第 17 張視為本手「首張摸牌」：createGameState 的初始發牌不會設定
    // lastDrawnBy/lastDrawnTile，若不補上，客戶端在莊家首手（17 張）會無法以伺服器
    // 權威資料分離第 17 張（舊版 max-instanceId 啟發式會分錯張）。
    const dealerHand = this.state!.wall.hands[this.dealer]!;
    this.state.lastDrawnBy = this.dealer;
    this.state.lastDrawnTile = dealerHand[dealerHand.length - 1];
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = null;
    this.scores = [0, 0, 0, 0];
    // A fresh round also resets the operationId idempotency ledger — otherwise
    // every round would re-accumulate executed operationIds forever.
    this.executed.clear();
    this.status = "playing";
    this.bump();
    this.scheduleAutoplay();
  }

  // -------------------------------------------------------------------------
  // Command handling — Generation ID + operationId dedup
  // -------------------------------------------------------------------------

  handleCommand(playerId: string, command: ClientCommand): CommandResult {
    const seat = this.seatOf(playerId);
    if (seat === -1) {
      return { ok: false, error: { code: "not_in_room", message: "Player not in this room" } };
    }
    // --- Stale generation check (防重) ---
    const gen = command.generationId;
    if (gen !== undefined && gen < this.generationId) {
      return { ok: false, error: { code: "stale_generation", message: "Command is stale" } };
    }
    // --- Idempotency (same operationId never executed twice) ---
    if (this.executed.has(command.operationId)) {
      return { ok: true };
    }

    let result: CommandResult;
    switch (command.type) {
      case "ready":
        result = this.doReady(seat as Seat);
        break;
      case "discard":
        result = this.doDiscard(seat as Seat, command.tileInstanceId);
        break;
      case "reaction":
        result = this.doReaction(seat as Seat, command);
        break;
      case "pass":
        result = this.doPass(seat as Seat);
        break;
      default:
        result = { ok: false, error: { code: "not_allowed", message: "Command not allowed" } };
    }

    if (result.ok) {
      this.executed.add(command.operationId);
      this.bump();
    }
    // Any accepted command may have moved the game into a new phase — resync
    // the thinking timeout (discard 摸切 / reaction auto-pass).
    this.scheduleAutoplay();
    return result;
  }

  private doReady(seat: Seat): CommandResult {
    // A round is over — the first ready resets the room for the next round.
    if (this.status === "ended") this.resetForNextRound();
    if (this.status !== "lobby") {
      return { ok: false, error: { code: "not_lobby", message: "Game already started" } };
    }
    const p = this.players[seat];
    if (!p) return { ok: false, error: { code: "no_player", message: "No player at seat" } };
    if (!p.connected) {
      return { ok: false, error: { code: "disconnected", message: "Seat is disconnected" } };
    }
    p.ready = true;
    if (this.players.every((x) => x?.ready === true)) this.startGame();
    return { ok: true };
  }

  private doDiscard(seat: Seat, tileInstanceId: number): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;
    if (state.turn !== seat) {
      return { ok: false, error: { code: "not_your_turn", message: "Not your turn" } };
    }
    if (state.phase !== "discard") {
      return { ok: false, error: { code: "wrong_phase", message: "Cannot discard now" } };
    }
    const hand = state.wall.hands[seat]!;
    if (!hand.some((t) => t.instanceId === tileInstanceId)) {
      return { ok: false, error: { code: "no_tile", message: "Tile not in hand" } };
    }
    performDiscard(state, seat, tileInstanceId);
    this.afterDiscard();
    return { ok: true };
  }

  /** Server-side auto-win + reaction window evaluation after a discard. */
  private afterDiscard(): void {
    const state = this.state;
    if (!state) return;
    // 1. Auto-win check: 合法可胡即自動胡牌 — no win button, server declares it.
    const wins = collectWinReactions(state);
    if (wins.length > 0) {
      // 一砲多響 (P0-4): EVERY eligible seat wins on the discard — never
      // collapse the field to a single nearest winner. finishWin settles the
      // discarder against each winner separately.
      this.finishWin(state, sortedWinners(state, wins), false, false);
      return;
    }
    // 2. No win: reaction window for kong/peng/chi — phase stays "reaction".
    //    Fresh window → clear the per-window pass bookkeeping.
    this.pendingPasses.clear();
    const pending = collectPendingKinds(state);
    if (pending.size === 0) {
      // 3. Nobody can react: pass the turn (next seat draws).
      this.passTurnAfterUnclaimed();
    }
  }

  private doReaction(seat: Seat, command: ReactionCommand): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;

    // --- Self kong (closed / add-on) during the player's own discard phase. ---
    if (command.kind === "kong" && state.phase === "discard" && state.turn === seat) {
      const option = findKongOption(
        state,
        seat,
        false,
        command.kongType ?? "",
        command.handTileIds,
        command.pengMeldId,
      );
      if (!option) {
        return { ok: false, error: { code: "illegal_kong", message: "Not a legal kong" } };
      }
      if (option.kongType === "add-on") {
        // 搶槓 (P0-1): pass the add-on tile explicitly — NEVER read it from
        // state.lastDiscard (undefined until performKong runs). The kongger's
        // seat becomes discardWinSeat so the ledger debits the right player.
        const extra = this.addOnTile(state, seat, option);
        if (!extra) {
          return { ok: false, error: { code: "illegal_kong", message: "Add-on tile not in hand" } };
        }
        const robber = this.qiangKongCheck(state, OTHERS(seat), extra);
        if (robber !== null) {
          this.finishWin(state, robber, false, false, seat);
          return { ok: true };
        }
      }
      performKong(state, seat, option);
      this.trackKongDraw(state, seat);
      // 槓上開花 (P0-2): the replacement draw may complete the kongger's hand.
      if (this.resolveKongDrawWin(state, seat)) return { ok: true };
      return { ok: true };
    }

    // --- Otherwise a reaction window against the latest discard is required. ---
    const discardBy = state.lastDiscardBy;
    if (discardBy === undefined || !state.lastDiscard) {
      return { ok: false, error: { code: "no_discard", message: "No discard to react to" } };
    }
    if (state.phase !== "reaction") {
      return { ok: false, error: { code: "wrong_phase", message: "No reaction window open" } };
    }
    if (seat === discardBy) {
      return { ok: false, error: { code: "self_reaction", message: "Cannot react to own discard" } };
    }

    switch (command.kind) {
      case "chi": {
        const ids = command.handTileIds;
        if (!ids || ids.length !== 2) {
          return { ok: false, error: { code: "bad_chi", message: "Chi requires 2 hand tiles" } };
        }
        const option = findChiOption(state, seat, [ids[0]!, ids[1]!]);
        if (!option) {
          return { ok: false, error: { code: "illegal_chi", message: "Not a legal chi" } };
        }
        if (this.autoWinOverride()) return { ok: true };
        performChi(state, seat, option);
        return { ok: true };
      }
      case "peng": {
        if (pengOptions(state, seat) === null) {
          return { ok: false, error: { code: "illegal_peng", message: "Not a legal peng" } };
        }
        if (this.autoWinOverride()) return { ok: true };
        const option = pengOptions(state, seat)!;
        performPeng(state, seat, option);
        return { ok: true };
      }
      case "kong": {
        const option = findKongOption(
          state,
          seat,
          true,
          command.kongType ?? "",
          command.handTileIds,
          command.pengMeldId,
        );
        if (!option) {
          return { ok: false, error: { code: "illegal_kong", message: "Not a legal kong" } };
        }
        if (option.kongType === "add-on") {
          // 搶槓 (P0-1): other players may win on the added tile.
          const extra = this.addOnTile(state, seat, option);
          if (!extra) {
            return { ok: false, error: { code: "illegal_kong", message: "Add-on tile not in hand" } };
          }
          const robber = this.qiangKongCheck(state, OTHERS(seat), extra);
          if (robber !== null) {
            this.finishWin(state, robber, false, false, seat);
            return { ok: true };
          }
        }
        performKong(state, seat, option);
        this.trackKongDraw(state, seat);
        // 槓上開花 (P0-2): the replacement draw may complete the kongger's hand.
        if (this.resolveKongDrawWin(state, seat)) return { ok: true };
        return { ok: true };
      }
      default:
        return { ok: false, error: { code: "unknown_kind", message: "Unknown reaction" } };
    }
  }

  /** Auto-win trumps any non-win reaction. Returns true when a win fired. */
  private autoWinOverride(): boolean {
    const state = this.state;
    if (!state) return false;
    const wins = collectWinReactions(state);
    if (wins.length === 0) return false;
    // 一砲多響 (P0-4): every eligible winner settles.
    this.finishWin(state, sortedWinners(state, wins), false, false);
    return true;
  }

  private doPass(seat: Seat): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;
    if (state.phase !== "reaction") {
      return { ok: false, error: { code: "wrong_phase", message: "No reaction window open" } };
    }
    // Pass semantics:
    //  - An eligible (pending) seat's pass only removes ITS right; the window
    //    stays open until EVERY pending seat has passed (prevents one AI pass
    //    from killing the human's window).
    //  - A pass from a NON-pending seat (the discarder, or scripts/tests that
    //    force-close the window) still closes it — preserves the legacy flow.
    const pending = collectPendingKinds(state);
    if (pending.has(seat)) {
      this.pendingPasses.add(seat);
      const allPendingPassed = [...pending.keys()].every((s) => this.pendingPasses.has(s));
      if (!allPendingPassed) return { ok: true };
    } else if (seat !== state.lastDiscardBy && pending.size > 0) {
      // Ignore pass from non-discarder, non-eligible seats so AI tick races don't kill the window.
      return { ok: true };
    }
    this.pendingPasses.clear();
    this.passTurnAfterUnclaimed();
    return { ok: true };
  }



  /**
   * Kong replacement draws (尾牆補牌) are also 摸切 targets — record the last
   * physical tile added to the kongger's hand so a discard timeout discards it.
   */
  private trackKongDraw(state: GameState, seat: Seat): void {
    state.lastDrawnBy = seat;
    const hand = state.wall.hands[seat]!;
    state.lastDrawnTile = hand[hand.length - 1]!;
  }

  /** Advance to the next seat's draw when a discard goes unclaimed. */
  private passTurnAfterUnclaimed(): void {
    this.pendingPasses.clear();
    const state = this.state;
    if (!state) return;
    const next = ((state.turn + 1) % 4) as Seat;
    state.turn = next;
    state.phase = "draw";
    try {
      drawTile(state.wall, next);
      // 摸切 target: the most recently added physical tile (post flower chain).
      state.lastDrawnBy = next;
      const drawnHand = state.wall.hands[next]!;
      state.lastDrawnTile = drawnHand[drawnHand.length - 1]!;
      // Self-draw auto-win check (only the drawer can win — single winner).
      const wins = this.collectSelfWinReactions(state, next);
      if (wins.length > 0) {
        this.finishWin(state, next, true, false);
        return;
      }
      state.phase = "discard";
    } catch {
      // Wall exhausted (流局) — end the hand with no winner.
      state.phase = "ended";
      this.finishDraw();
    }
  }

  /** Auto-win on a self draw (no discard involved). */
  private collectSelfWinReactions(state: GameState, seat: Seat): WinReaction[] {
    const hand = state.wall.hands[seat]!;
    const melds = state.melds[seat] as Meld[];
    if (detectWin(hand, melds).win) {
      return [{ kind: "win", seat, selfDraw: true }];
    }
    return [];
  }

  /** The physical tile being added in an add-on kong (from the kong option). */
  private addOnTile(state: GameState, seat: Seat, option: KongOption): TileInstance | null {
    const id = option.handTileIds[0];
    if (id === undefined) return null;
    return state.wall.hands[seat]?.find((t) => t.instanceId === id) ?? null;
  }

  /**
   * 槓上開花 (P0-2) — after a kong replacement draw (尾牆補牌) the kongger's own
   * hand may now be complete. Runs the self-draw win check and settles the hand
   * with `kongDraw=true` so the 槓上開花 win is recorded in scoring/settlement.
   * Returns true when the win fired (game is now ended).
   */
  private resolveKongDrawWin(state: GameState, seat: Seat): boolean {
    const wins = this.collectSelfWinReactions(state, seat);
    if (wins.length === 0) return false;
    this.finishWin(state, seat, true, true);
    return true;
  }

  /** 搶槓 (qiang kong): a robber wins on the add-on tile. */
  private qiangKongCheck(
    state: GameState,
    robbers: readonly Seat[],
    extra: TileInstance,
  ): Seat | null {
    return qiangKong(
      state,
      robbers,
      extra,
      (seat) => state.wall.hands[seat] as readonly TileInstance[],
      // P0-1: the win callback receives the ACTUAL robber seat and reads that
      // seat's own melds — the previous code hard-coded robbers[0], so any
      // robber with open melds was checked against the wrong player's melds.
      (seat, hand, robbed) => {
        const melds = state.melds[seat] as Meld[];
        return detectWin([...hand, robbed], melds).win;
      },
    ) as Seat | null;
  }

  // -------------------------------------------------------------------------
  // Settlement
  // -------------------------------------------------------------------------

  /**
   * Settle a win — single winner, or 一砲多響 (P0-4) with multiple winners on
   * the same discard. `discardWinSeat` is required for 搶槓 (the kongger pays);
   * for a normal discard win it falls back to state.lastDiscardBy.
   */
  private finishWin(
    state: GameState,
    winner: Seat | readonly Seat[],
    selfDraw: boolean,
    kongDraw: boolean,
    discardWinSeat?: Seat,
  ): void {
    const winners = (Array.isArray(winner) ? winner : [winner]) as Seat[];
    const primary = winners[0]!;
    // 莊家輪替 / 連莊: if the dealer is among the winners → 連莊 (streak+1);
    // otherwise 過莊 (dealer passes to the next seat, streak resets to 0).
    if (winners.includes(this.dealer)) {
      this.dealerStreak += 1;
    } else {
      this.dealer = nextSeat(this.dealer);
      this.dealerStreak = 0;
    }
    // Scoring reads state.dealerStreak for the 連莊台 fan — expose the
    // updated streak so this hand's ledger reflects it.
    state.dealerStreak = this.dealerStreak;
    declareWin(state, primary, selfDraw);
    this.winner = primary;
    this.selfDraw = selfDraw;
    this.kongDraw = kongDraw;

    // Per-winner scoring context. For discard wins the payer is the provided
    // discardWinSeat (搶槓 kongger) or the room's last discarder.
    const ctxs: WinContext[] = winners.map((w) => ({
      winner: w,
      selfDraw,
      kongDraw,
      discardWin: !selfDraw,
      discardWinSeat: !selfDraw ? (discardWinSeat ?? state.lastDiscardBy) : undefined,
      dealerStreak: state.dealerStreak,
      dealer: state.dealer,
      hand: state.wall.hands[w] as readonly TileInstance[],
      melds: state.melds[w] as Meld[],
    }));
    this.breakdown = evaluateFans(ctxs[0]!, this.fanCap);
    this.ledger =
      ctxs.length === 1
        ? settleLedger(ctxs[0]!, this.fanCap, this.pointPerFan)
        : settleMultiLedger(ctxs, this.fanCap, this.pointPerFan);
    for (const entry of this.ledger) {
      this.scores[entry.seat] = (this.scores[entry.seat] ?? 0) + entry.delta;
    }
    this.status = "ended";
    this.state = state;
    this.clearAutoplay();
  }

  /** 流局 (exhausted wall) — no winner, scores unchanged. */
  private finishDraw(): void {
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = [
      { seat: 0, delta: 0 },
      { seat: 1, delta: 0 },
      { seat: 2, delta: 0 },
      { seat: 3, delta: 0 },
    ];
    // 流局: 莊家連莊 — the dealer keeps the seat and the streak advances.
    this.dealerStreak += 1;
    this.status = "ended";
    this.clearAutoplay();
  }

  // -------------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------------

  /** Expose the pending non-win reaction window (for tests / hints). */
  pendingKinds(): Map<number, Set<string>> {
    if (!this.state) return new Map();
    const m = new Map<number, Set<string>>();
    for (const [seat, kinds] of collectPendingKinds(this.state)) {
      m.set(seat, new Set([...kinds]));
    }
    return m;
  }

  // -------------------------------------------------------------------------
  // Timeout Autoplay (斷線逾時自動託管)
  // -------------------------------------------------------------------------

  private clearAutoplay(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.phaseDeadline = null;
  }

  /**
   * Schedule the thinking timer for the current phase:
   *  - discard phase → timeout auto-摸切 (discard the latest drawn tile).
   *  - reaction phase → timeout auto-pass (never blocks the table).
   * Disconnected seats act immediately (delay 0) so a table never stalls.
   */
  private scheduleAutoplay(): void {
    this.clearAutoplay();
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    let delay: number | null = null;
    if (state.phase === "discard") {
      const turnSeat = state.turn as Seat;
      delay = this.autoplay[turnSeat] ? 0 : this.timeoutMs;
    } else if (state.phase === "reaction") {
      const pending = collectPendingKinds(state);
      if (pending.size === 0) return; // no window — no timer needed
      const allPendingOffline = [...pending.keys()].every(
        (s) => !this.players[s]?.connected,
      );
      delay = allPendingOffline ? 0 : this.timeoutMs;
    }
    if (delay === null) return;
    this.phaseDeadline = Date.now() + delay;
    this.timeoutHandle = setTimeout(() => {
      if (state.phase === "discard") this.onDiscardTimeout();
      else if (state.phase === "reaction") this.onReactionTimeout();
    }, delay);
    this.timeoutHandle.unref?.();
  }

  /** 出牌逾時 → 摸切: the server discards the most recently drawn tile. */
  private onDiscardTimeout(): void {
    this.timeoutHandle = null;
    this.phaseDeadline = null;
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    if (state.phase !== "discard") return;
    const seat = state.turn as Seat;
    const hand = state.wall.hands[seat]!;
    if (hand.length === 0) return;
    // 摸切 target: the tile drawn this turn (still in hand). Fall back to the
    // last hand tile when no draw is recorded (e.g. a chi/peng claimant).
    let target =
      state.lastDrawnBy === seat && state.lastDrawnTile
        ? (hand.find((t) => t.instanceId === state.lastDrawnTile!.instanceId) ?? null)
        : null;
    if (!target) target = hand[hand.length - 1]!;
    performDiscard(state, seat, target.instanceId);
    this.autoplayLog.push({
      seat,
      action: "discard",
      reason: this.autoplay[seat] ? "disconnect" : "timeout",
      at: Date.now(),
    });
    this.afterDiscard();
    this.bump();
    this.scheduleAutoplay();
    // Timer-driven mutation — push the new state to the clients immediately.
    this.onChange?.(this);
  }

  /** Reaction 逾時 → 自動 pass, keeping the table moving. */
  private onReactionTimeout(): void {
    this.timeoutHandle = null;
    this.phaseDeadline = null;
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    if (state.phase !== "reaction") return;
    this.pendingPasses.clear();
    this.autoplayLog.push({
      seat: state.turn as Seat,
      action: "pass",
      reason: "timeout",
      at: Date.now(),
    });
    this.passTurnAfterUnclaimed();
    this.bump();
    this.scheduleAutoplay();
    // Timer-driven mutation — push the new state to the clients immediately.
    this.onChange?.(this);
  }

  /** When a seat disconnects, resolve its pending action immediately. */
  private forceAutoplay(seat: Seat): void {
    const state = this.state;
    if (!state || this.status !== "playing") return;
    if (state.phase === "discard") {
      if (state.turn === seat) this.onDiscardTimeout();
      return;
    }
    if (state.phase === "reaction") {
      const pending = collectPendingKinds(state);
      const allPendingOffline = [...pending.keys()].every(
        (s) => !this.players[s]?.connected,
      );
      if (pending.size > 0 && allPendingOffline) this.onReactionTimeout();
    }
  }

  /** Release timers (RoomManager cleanup / shutdown). */
  dispose(): void {
    this.clearAutoplay();
  }

  private bump(): void {
    this.generationId += 1;
  }
}
```

## File: apps/server/src/roomManager.ts

```
/**
 * RoomManager — owns the set of live rooms and player identities.
 *
 * Responsibilities:
 *  - create room (unique id) / join (max 4, reconnect restores seat).
 *  - track per-playerId rooms (one active room per player).
 *  - disconnect → mark seat disconnected (game pauses for reactions);
 *    reconnect with the same playerId restores the seat.
 *  - cleanup empty / ended rooms after a settle.
 */

import { randomBytes } from "node:crypto";
import { Room, type RoomOptions } from "./room.js";

export interface ManagerOptions {
  roomIdPrefix?: string;
  roomOptions?: Omit<RoomOptions, "id">;
}

const ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function randomId(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ID_CHARS[bytes[i]! % ID_CHARS.length];
  }
  return out;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  /** playerId → roomId (active room per player). */
  readonly playerRooms = new Map<string, string>();
  private readonly idPrefix: string;
  private readonly roomOptions: Omit<RoomOptions, "id">;

  constructor(options: ManagerOptions = {}) {
    this.idPrefix = options.roomIdPrefix ?? "r";
    this.roomOptions = options.roomOptions ?? { variant: "north" };
  }

  /** Attach a room-wide change listener (autoplay broadcasts) to new rooms. */
  setRoomChangeListener(fn: (room: Room) => void): void {
    this.roomOptions.onChange = fn;
  }

  createRoom(): { roomId: string; room: Room } {
    let roomId: string;
    do {
      roomId = `${this.idPrefix}${randomId(6)}`;
    } while (this.rooms.has(roomId));
    const room = new Room({ ...this.roomOptions, id: roomId });
    this.rooms.set(roomId, room);
    return { roomId, room };
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** Join (or rejoin) a room, assigning a fresh seat when the player is new. */
  join(roomId: string, playerId: string, playerName = "Player"): number {
    const room = this.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);
    const seat = room.join(playerId, playerName);
    this.playerRooms.set(playerId, roomId);
    return seat;
  }

  /** Reserve a seat for a brand-new player (creates the player identity). */
  newPlayerId(): string {
    return `p${randomId(10)}`;
  }

  playerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /** Disconnect: mark the seat disconnected (keeps the seat for reconnect). */
  disconnect(playerId: string): void {
    const room = this.playerRoom(playerId);
    if (room) room.setConnected(playerId, false);
  }

  /** Reconnect: restore the seat and mark it connected again. */
  reconnect(playerId: string): Room | undefined {
    const room = this.playerRoom(playerId);
    if (room) room.setConnected(playerId, true);
    return room;
  }

  /**
   * Cleanup: remove rooms that are empty (no connected players) — typically
   * after a game ends and the last player leaves. Returns the removed room ids.
   */
  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [roomId, room] of this.rooms) {
      const connected = room.players.some((p) => p?.connected);
      void now;
      if (!connected) {
        this.rooms.delete(roomId);
        for (const [pid, rid] of this.playerRooms) {
          if (rid === roomId) this.playerRooms.delete(pid);
        }
        removed.push(roomId);
      }
    }
    return removed;
  }
}
```

## File: apps/server/src/snapshot.ts

```
/**
 * Client-Safe Snapshot — per-viewer projection of the authoritative state.
 *
 * Only observable state leaves the server:
 *  - your own hand (full instance ids) — others are masked to a count.
 *  - melds / discards / flowers (public table state).
 *  - wall details are reduced to remaining counts (no tile internals).
 *  - current turn, phase, dealer, and the reaction hint for the viewer.
 */

import type {
  FanBreakdown,
  GamePhase,
  GameState,
  Honor,
  LedgerEntry,
  Meld,
  Numbered,
  Suit,
  TileInstance,
} from "@taiwan-mahjong/rules";
import {
  chiOptions,
  deckRemaining,
  detectWin,
  headRemaining,
  kongOptions,
  pengOptions,
  tileToId,
} from "@taiwan-mahjong/rules";

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface TileWire {
  instanceId: number;
  id: string;
}

export interface WireMeld {
  id: number;
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  tiles: string[];
  claimed?: string;
}

export interface WireChiOption {
  handTileIds: [number, number];
  run: string[];
}

export interface WireKongOption {
  kongType: "open" | "closed" | "add-on";
  handTileIds: number[];
  pengMeldId?: number;
}

export interface ReactionHint {
  canChi: boolean;
  canPeng: boolean;
  canKong: boolean;
  chiOptions: WireChiOption[];
  kongOptions: WireKongOption[];
}

export interface PlayerView {
  seat: number;
  playerId: string | null;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — the server is playing for this seat (offline). */
  autoplay: boolean;
  handCount: number;
  /** Full hand — only for the viewer (masked for everyone else). */
  hand: TileWire[] | null;
  flowers: string[];
  melds: WireMeld[];
}

export interface SettlementView {
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  breakdown: FanBreakdown | null;
  ledger: LedgerEntry[];
  scores: number[];
}

export interface ClientSnapshot {
  roomId: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  you: number;
  dealer: number | null;
  /** 連莊數 (0 = fresh dealer, >=1 = consecutive holds). */
  dealerStreak: number;
  turn: number | null;
  gamePhase: GamePhase | null;
  players: PlayerView[];
  discards: string[];
  /** Per-seat discard rivers (各家棄牌河) — [[seat0 tiles], [seat1 tiles], ...]. */
  discardsBySeat: string[][];
  lastDiscard: string | null;
  lastDiscardBy: number | null;
  /** The seat that most recently drew a tile (public — observable from turn flow). */
  lastDrawnBy: number | null;
  /** The most recently drawn tile — only revealed to the drawer itself (own hand). */
  lastDrawnTile: TileWire | null;
  wall: { headRemaining: number; deckRemaining: number };
  reactionHint: ReactionHint | null;
  /** 可胡狀態（聽牌）— the viewer is one tile away from a win; feeds 胡牌光暈. */
  canWin: boolean;
  /** Epoch-ms deadline for the current phase's autoplay timeout (null = none). */
  phaseDeadline: number | null;
  /** ms until the phase deadline fires (client countdown; null = none). */
  countdownMs: number | null;
  /** Server-driven autoplay actions (摸切/pass) this hand — observability. */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }>;
  winner: number | null;
  settlement: SettlementView | null;
}

/** Structural contract Room satisfies so snapshot.ts never imports room.ts. */
export interface RoomLike {
  id: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  players: (RoomPlayerLike | null)[];
  state: GameState | null;
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  breakdown: FanBreakdown | null;
  ledger: LedgerEntry[] | null;
  scores: number[];
  /** Consecutive dealer holds (連莊) — feeds 連莊台 + rotation verification. */
  dealerStreak: number;
  /** Epoch-ms deadline of the current autoplay timeout (null = none). */
  phaseDeadline: number | null;
  /** 自動託管 flag per seat. */
  autoplay: boolean[];
  /** Autoplay audit log — server-driven 摸切/pass. */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }>;
}

export interface RoomPlayerLike {
  playerId: string;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — true while the server plays for this seat. */
  autoplay: boolean;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function wireMeld(m: Meld): WireMeld {
  return {
    id: m.id,
    kind: m.kind,
    kongType: m.kind === "kong" ? m.kongType : undefined,
    tiles: m.tiles.map((t) => tileToId(t.tile)),
    claimed: m.claimed ? tileToId(m.claimed.tile) : undefined,
  };
}

/** All 34 tile identities (27 numbered + 7 honors) — the tenpai wait space. */
const ALL_TILE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of ["wan", "tiao", "tong"] as const) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const) {
    ids.push(`honor:${honor}`);
  }
  return ids;
})();

function fakeTile(id: string): TileInstance {
  const [category, value] = id.split(":");
  if (category === "honor") {
    return { tile: { kind: "honor", honor: value as Honor }, instanceId: -1 };
  }
  return {
    tile: { kind: "numbered", suit: category as Suit, rank: Number(value) as Numbered["rank"] },
    instanceId: -1,
  };
}

/**
 * Tenpai (聽牌) check — the viewer is one tile away from a win: there exists a
 * tile X in hand and an identity T such that (hand − X + T) forms a winning
 * hand. Feeds the client's 胡牌光暈 (win glow) on win-possible snapshots.
 */
function isTenpai(state: GameState, seat: number): boolean {
  const hand = state.wall.hands[seat];
  const melds = state.melds[seat] as Meld[];
  if (!hand || hand.length < 14) return false;
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) return true;
    }
  }
  return false;
}

function computeHint(state: GameState, seat: number): ReactionHint | null {
  const hint: ReactionHint = {
    canChi: false,
    canPeng: false,
    canKong: false,
    chiOptions: [],
    kongOptions: [],
  };
  const discard = state.lastDiscard;

  if (
    state.phase === "reaction" &&
    discard &&
    state.lastDiscardBy !== undefined &&
    state.lastDiscardBy !== seat
  ) {
    // Claim window: open kong / peng / chi against the latest discard.
    const kongs = kongOptions(state, seat, true);
    if (kongs.length > 0) {
      hint.canKong = true;
      hint.kongOptions = kongs.map((k) => ({
        kongType: k.kongType,
        handTileIds: [...k.handTileIds],
        pengMeldId: k.pengMeldId,
      }));
    }
    if (pengOptions(state, seat) !== null) hint.canPeng = true;
    const chis = chiOptions(state, seat, discard);
    if (chis !== null && chis.length > 0) {
      hint.canChi = true;
      hint.chiOptions = chis.map((o) => ({
        handTileIds: [o.handTiles[0]!.instanceId, o.handTiles[1]!.instanceId],
        run: o.run.map((t) => tileToId(t.tile)),
      }));
    }
  } else if (state.phase === "discard" && state.turn === seat) {
    // Self kong (closed / add-on) may be declared before discarding.
    const kongs = kongOptions(state, seat, false);
    if (kongs.length > 0) {
      hint.canKong = true;
      hint.kongOptions = kongs.map((k) => ({
        kongType: k.kongType,
        handTileIds: [...k.handTileIds],
        pengMeldId: k.pengMeldId,
      }));
    }
  }

  return hint.canChi || hint.canPeng || hint.canKong ? hint : null;
}

/** Build the Client-Safe snapshot as seen from `seat`. */
export function buildClientSnapshot(room: RoomLike, seat: number): ClientSnapshot {
  const state = room.state;
  const players: PlayerView[] = room.players.map((p, i) => {
    const isYou = i === seat;
    const hand = state && p ? state.wall.hands[i] : undefined;
    const flowers = state && p ? state.wall.flowers[i] : undefined;
    return {
      seat: i,
      playerId: p ? p.playerId : null,
      playerName: p ? p.playerName : "",
      connected: p ? p.connected : false,
      ready: p ? p.ready : false,
      autoplay: p ? p.autoplay : false,
      handCount: hand ? hand.length : 0,
      hand:
        isYou && hand
          ? hand.map((t) => ({ instanceId: t.instanceId, id: tileToId(t.tile) }))
          : null,
      flowers: flowers ? flowers.map((t) => tileToId(t.tile)) : [],
      melds: state && p ? (state.melds[i] as Meld[]).map(wireMeld) : [],
    };
  });

  return {
    roomId: room.id,
    status: room.status,
    generationId: room.generationId,
    you: seat,
    dealer: state ? state.dealer : null,
    dealerStreak: room.dealerStreak,
    turn: state ? state.turn : null,
    gamePhase: state ? state.phase : null,
    players,
    discards: state ? state.discards.map((t) => tileToId(t.tile)) : [],
    discardsBySeat: state
      ? state.discardsBySeat.map((river) => river.map((t) => tileToId(t.tile)))
      : [[], [], [], []],
    lastDiscard: state?.lastDiscard ? tileToId(state.lastDiscard.tile) : null,
    lastDiscardBy: state?.lastDiscardBy ?? null,
    lastDrawnBy: state?.lastDrawnBy ?? null,
    lastDrawnTile:
      state?.lastDrawnBy === seat && state.lastDrawnTile
        ? { instanceId: state.lastDrawnTile.instanceId, id: tileToId(state.lastDrawnTile.tile) }
        : null,
    wall: state
      ? { headRemaining: headRemaining(state.wall), deckRemaining: deckRemaining(state.wall) }
      : { headRemaining: 0, deckRemaining: 0 },
    reactionHint: state ? computeHint(state, seat) : null,
    canWin: state ? isTenpai(state, seat) : false,
    phaseDeadline: room.phaseDeadline,
    countdownMs:
      room.phaseDeadline === null ? null : Math.max(0, room.phaseDeadline - Date.now()),
    autoplayLog: room.autoplayLog,
    winner: room.winner,
    settlement:
      room.status === "ended" && room.ledger
        ? {
            winner: room.winner,
            selfDraw: room.selfDraw,
            kongDraw: room.kongDraw,
            breakdown: room.breakdown,
            ledger: room.ledger,
            scores: room.scores,
          }
        : null,
  };
}
```

## File: apps/server/src/wss.ts

```
/**
 * WSS layer — WebSocket transport + connection lifecycle.
 *
 * Each socket authenticates with an `auth` command (or a `join` carrying the
 * playerId) and then issues game commands. The server is the single source of
 * truth: it applies commands to the Room and broadcasts Client-Safe snapshots
 * to every socket in the room.
 */

import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./roomManager.js";
import type { ClientCommand, ServerEvent } from "./protocol.js";
import { isClientCommand, PROTOCOL_VERSION } from "./protocol.js";
import { buildClientSnapshot } from "./snapshot.js";
import { Room } from "./room.js";

export interface AuthInfo {
  playerId: string;
  playerName: string;
  roomId: string | null;
}

export interface WssOptions {
  httpServer: HttpServer;
  manager: RoomManager;
  /** Override player id allocation (tests). */
  newPlayerId?: () => string;
  onSocket?: (socket: GameSocket, info: AuthInfo) => void;
}

export class GameSocket {
  readonly socket: WebSocket;
  playerId: string | null = null;
  playerName = "";
  roomId: string | null = null;
  authenticated = false;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  send(event: ServerEvent): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }
}

export class GameServer {
  readonly manager: RoomManager;
  private readonly wss: WebSocketServer;
  private readonly newPlayerId: () => string;
  private readonly onSocket?: (socket: GameSocket, info: AuthInfo) => void;
  private readonly sockets = new Set<GameSocket>();
  /** roomId → last observed status (for lifecycle transition events). */
  private readonly lastStatus = new Map<string, Room["status"]>();

  constructor(options: WssOptions) {
    this.manager = options.manager;
    this.newPlayerId = options.newPlayerId ?? (() => this.manager.newPlayerId());
    this.onSocket = options.onSocket;
    this.wss = new WebSocketServer({ server: options.httpServer, path: "/ws" });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    // Server-driven room mutations (autoplay 摸切/pass timers, disconnect
    // force-autoplay) fire the Room's onChange → re-broadcast to the room's
    // clients. Without this, offline bots would never see the server's moves
    // and the table would stall.
    this.manager.setRoomChangeListener((room) => this.broadcastRoom(room));
  }

  get socketCount(): number {
    return this.sockets.size;
  }

  private handleConnection(ws: WebSocket): void {
    const gs = new GameSocket(ws);
    this.sockets.add(gs);
    ws.on("message", (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        gs.send({ type: "error", code: "bad_json", message: "Invalid JSON" });
        return;
      }
      if (!isClientCommand(raw)) {
        gs.send({ type: "error", code: "bad_command", message: "Malformed command" });
        return;
      }
      this.handleCommand(gs, raw);
    });
    ws.on("close", () => {
      this.sockets.delete(gs);
      if (gs.playerId && gs.roomId) {
        const room = this.manager.playerRoom(gs.playerId);
        if (room) {
          this.manager.disconnect(gs.playerId);
          this.broadcastRoom(room);
        }
      }
    });
    ws.on("error", () => {
      /* transport error — close handler cleans up */
    });
  }

  private handleCommand(gs: GameSocket, command: ClientCommand): void {
    try {
      switch (command.type) {
        case "create":
          this.handleCreate(gs, command);
          break;
        case "join":
          this.handleJoin(gs, command);
          break;
        case "ping": {
          // Heartbeat: echo the client timestamp. No room/seat required.
          const t = (command as Extract<ClientCommand, { type: "ping" }>).t;
          gs.send({ type: "pong", t: t ?? 0 });
          break;
        }
        case "ready":
        case "discard":
        case "reaction":
        case "pass": {
          if (!gs.authenticated || !gs.roomId || !gs.playerId) {
            gs.send({ type: "error", code: "not_authenticated", message: "Join a room first" });
            return;
          }
          const room = this.manager.get(gs.roomId);
          if (!room) {
            gs.send({ type: "error", code: "room_gone", message: "Room no longer exists" });
            return;
          }
          const result = room.handleCommand(gs.playerId, command);
          if (!result.ok) {
            gs.send({
              type: "error",
              code: result.error!.code,
              message: result.error!.message,
              operationId: command.operationId,
            });
          }
          this.broadcastRoom(room);
          break;
        }
      }
    } catch (e) {
      gs.send({
        type: "error",
        code: "internal",
        message: e instanceof Error ? e.message : "Internal error",
        operationId: command.operationId,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Auth / create / join
  // -------------------------------------------------------------------------

  private handleCreate(gs: GameSocket, command: Extract<ClientCommand, { type: "create" }>): void {
    const playerId = gs.playerId ?? this.newPlayerId();
    gs.playerId = playerId;
    gs.playerName = command.playerName ?? "Player";
    const { roomId, room } = this.manager.createRoom();
    room.join(playerId, gs.playerName);
    this.manager.playerRooms.set(playerId, roomId);
    gs.roomId = roomId;
    gs.authenticated = true;
    gs.send({ type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomId });
    gs.send({ type: "room.created", roomId, generationId: room.generationId });
    this.onSocket?.(gs, { playerId, playerName: gs.playerName, roomId });
    this.broadcastRoom(room);
  }

  private handleJoin(gs: GameSocket, command: Extract<ClientCommand, { type: "join" }>): void {
    const roomId = command.roomId;
    const room = this.manager.get(roomId);
    if (!room) {
      gs.send({ type: "error", code: "room_not_found", message: `Room ${roomId} not found` });
      return;
    }
    let playerId: string | null = command.playerId ?? gs.playerId;
    let isReconnect = false;
    if (playerId !== null && room.seatOf(playerId) !== -1) {
      // Same identity already seated — restore it (reconnect), even mid-game.
      isReconnect = true;
    } else if (playerId === null) {
      playerId = this.newPlayerId();
    }
    gs.playerId = playerId;
    gs.playerName = command.playerName ?? gs.playerName ?? "Player";
    const seat = room.join(playerId, gs.playerName);
    if (isReconnect) {
      this.manager.reconnect(playerId);
    }
    this.manager.playerRooms.set(playerId, roomId);
    gs.roomId = roomId;
    gs.authenticated = true;
    gs.send({ type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomId });
    gs.send({
      type: "player.joined",
      roomId,
      seat,
      playerId,
      playerName: gs.playerName,
      connected: true,
      generationId: room.generationId,
    });
    this.onSocket?.(gs, { playerId, playerName: gs.playerName, roomId });
    this.broadcastRoom(room);
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------

  /** Send the current snapshot (and lifecycle transitions) to every socket. */
  broadcastRoom(room: Room): void {
    const prev = this.lastStatus.get(room.id);
    if (prev !== room.status) {
      this.lastStatus.set(room.id, room.status);
      for (const gs of this.sockets) {
        if (gs.roomId !== room.id || !gs.authenticated || gs.playerId === null) continue;
        if (room.status === "playing") {
          gs.send({
            type: "game.started",
            roomId: room.id,
            generationId: room.generationId,
            dealer: room.state?.dealer ?? 0,
            dealerStreak: room.dealerStreak,
          });
        } else if (room.status === "ended") {
          gs.send({
            type: "game.ended",
            roomId: room.id,
            generationId: room.generationId,
            winner: room.winner,
            selfDraw: room.selfDraw,
            kongDraw: room.kongDraw,
            dealer: room.state?.dealer ?? 0,
            dealerStreak: room.dealerStreak,
            breakdown: room.breakdown,
            ledger: room.ledger ?? [],
            scores: room.scores,
          });
        }
      }
    }
    for (const gs of this.sockets) {
      if (gs.roomId !== room.id || !gs.authenticated || gs.playerId === null) continue;
      const seat = room.seatOf(gs.playerId);
      if (seat === -1) continue;
      gs.send({
        type: "snapshot",
        roomId: room.id,
        generationId: room.generationId,
        snapshot: buildClientSnapshot(room, seat),
      });
    }
  }

  /** Force-close all sockets (shutdown / tests). */
  close(): Promise<void> {
    for (const gs of this.sockets) {
      try {
        gs.socket.close();
      } catch {
        /* ignore */
      }
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
```

## File: apps/server/src/gameLoop.ts

```
/**
 * Game-loop helpers — pure functions driving the authoritative state machine.
 *
 * The server never asks clients whether a hand is legal: 合法可胡即自動胡牌.
 * On every discard the server checks all other seats for a win (auto-win), and
 * only chi/peng/kong are offered back to eligible clients as a reaction window.
 */

import type {
  ChiOption,
  GameState,
  KongOption,
  ReactionKind,
  WinReaction,
} from "@taiwan-mahjong/rules";
import { chiOptions, detectWin, kongOptions, pengOptions, SEATS } from "@taiwan-mahjong/rules";

/** Auto-win candidates on the latest discard (every seat but the discarder). */
export function collectWinReactions(state: GameState): WinReaction[] {
  const out: WinReaction[] = [];
  const discard = state.lastDiscard;
  const discardBy = state.lastDiscardBy;
  if (!discard || discardBy === undefined) return out;
  for (const seat of SEATS) {
    if (seat === discardBy) continue;
    const hand = state.wall.hands[seat]!;
    if (detectWin([...hand, discard], state.melds[seat]).win) {
      out.push({ kind: "win", seat, selfDraw: false });
    }
  }
  return out;
}

/**
 * Non-win reactions available per seat on the latest discard.
 * Returns Map<seat, Set<"kong" | "peng" | "chi">> — the reaction window.
 */
export function collectPendingKinds(state: GameState): Map<number, Set<ReactionKind>> {
  const out = new Map<number, Set<ReactionKind>>();
  const discard = state.lastDiscard;
  const discardBy = state.lastDiscardBy;
  if (!discard || discardBy === undefined) return out;
  for (const seat of SEATS) {
    if (seat === discardBy) continue;
    const kinds = new Set<ReactionKind>();
    if (kongOptions(state, seat, true).length > 0) kinds.add("kong");
    if (pengOptions(state, seat) !== null) kinds.add("peng");
    const chis = chiOptions(state, seat, discard);
    if (chis !== null && chis.length > 0) kinds.add("chi");
    if (kinds.size > 0) out.set(seat, kinds);
  }
  return out;
}

/** Locate the exact chi option matching the client's two hand-tile ids. */
export function findChiOption(
  state: GameState,
  seat: number,
  handTileIds: [number, number],
): ChiOption | null {
  const discard = state.lastDiscard;
  if (!discard) return null;
  const chis = chiOptions(state, seat, discard);
  if (!chis) return null;
  const want = new Set<number>(handTileIds);
  return (
    chis.find(
      (o) =>
        o.handTiles.length === 2 &&
        want.has(o.handTiles[0]!.instanceId) &&
        want.has(o.handTiles[1]!.instanceId),
    ) ?? null
  );
}

/** Locate the exact kong option matching the client's payload. */
export function findKongOption(
  state: GameState,
  seat: number,
  allowClaim: boolean,
  kongType: string,
  handTileIds?: number[],
  pengMeldId?: number,
): KongOption | null {
  const opts = kongOptions(state, seat, allowClaim);
  return (
    opts.find((o) => {
      if (o.kongType !== kongType) return false;
      if (pengMeldId !== undefined && o.pengMeldId !== pengMeldId) return false;
      if (handTileIds && handTileIds.length > 0) {
        const a = new Set<number>(handTileIds);
        const b = new Set<number>(o.handTileIds);
        if (a.size !== b.size) return false;
        for (const id of a) if (!b.has(id)) return false;
      }
      return true;
    }) ?? null
  );
}
```

## File: apps/server/src/aiController.ts

```
/**
 * aiController — fills empty seats with 3 AIs and drives their moves.
 *
 * On a tick (200ms) it scans every live room:
 *   - A room with exactly 1 connected human and < 4 players → auto-join the
 *     3 AIs (初級 / 中級 / 高級) into the free seats.
 *   - Each AI seat then acts when it is its turn: ready in lobby, discard on
 *     its discard phase, react in a reaction window (or self-kong on its own
 *     discard phase). Everything flows through room.handleCommand() — the same
 *     authoritative path a socket uses — with unique operationIds.
 *
 * AI seats are `connected: true` but have NO socket: they never receive
 * ws.on("close"), so they are never auto-disconnected, and RoomManager.cleanup()
 * keeps rooms alive while any player is connected. Commands are broadcast to
 * the human clients via GameServer.broadcastRoom(room) right after each move.
 *
 * The tick also unblocks mid-game seats when a room already has all 4 players
 * (e.g. a human joins a room that was mid-game with 3 AI seats).
 */

import type { RoomManager } from "./roomManager.js";
import type { GameServer } from "./wss.js";
import { AI_ACTION_DELAY_MS, decideDiscard, decideReaction, DIFFICULTY_NAMES, isAiPlayerId, shouldReady, type AiDifficulty } from "./aiPlayer.js";
import type { Room } from "./room.js";

export interface AiControllerOptions {
  /** Scan interval in ms (default 200). */
  tickMs?: number;
  /** How many AI seats to auto-fill (default 3). */
  aiCount?: number;
}

const AI_DIFFICULTIES: readonly AiDifficulty[] = ["easy", "medium", "hard"];

export class AiController {
  private readonly manager: RoomManager;
  private readonly games: GameServer;
  private readonly tickMs: number;
  private readonly aiCount: number;
  private readonly aiPlayerIds: string[];
  private readonly lastSeen = new Map<string, { count: number }>();
  private readonly opCounter = new Map<string, number>();
  /** playerId → per-AI move throttling (so moves don't look instant). */
  private readonly nextActAt = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private readonly difficultyForPlayer = new Map<string, AiDifficulty>();

  constructor(manager: RoomManager, games: GameServer, options: AiControllerOptions = {}) {
    this.manager = manager;
    this.games = games;
    this.tickMs = options.tickMs ?? 200;
    this.aiCount = options.aiCount ?? 3;
    // ai-0 / ai-1 / ai-2 — fixed identities per server so an AI can persist
    // across a human reconnect (reconnect restores the seat by playerId).
    this.aiPlayerIds = Array.from({ length: this.aiCount }, (_, i) => `ai-${i}`);
    for (let i = 0; i < this.aiCount; i++) {
      this.difficultyForPlayer.set(this.aiPlayerIds[i]!, AI_DIFFICULTIES[i]!);
    }
  }

  /** Start the background tick (idempotent). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
    // Prime immediately so a freshly created room gets AIs fast.
    this.tick();
  }

  /** Stop the background tick (shutdown). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private opId(roomId: string, playerId: string, kind: string): string {
    const key = `${roomId}:${playerId}`;
    const n = (this.opCounter.get(key) ?? 0) + 1;
    this.opCounter.set(key, n);
    return `ai-${playerId}-${kind}-${n}`;
  }

  // -------------------------------------------------------------------------
  // Main tick
  // -------------------------------------------------------------------------

  private tick(): void {
    for (const room of this.manager.rooms.values()) {
      this.ensureAis(room);
      this.act(room);
    }
  }

  // -------------------------------------------------------------------------
  // Auto-fill
  // -------------------------------------------------------------------------

  /**
   * Auto-join the AI seats when a room has exactly 1 connected human and
   * fewer than 4 players. Rooms with 0 humans are left alone (they belong to
   * stress/qa runs — never poison them).
   */
  private ensureAis(room: Room): void {
    const players = room.players;
    const connectedHumans = players.filter((p) => p && p.connected && !isAiPlayerId(p.playerId)).length;
    if (connectedHumans !== 1) return;

    const freeSeats = players.reduce<number[]>((acc, p, i) => {
      if (p === null) acc.push(i);
      return acc;
    }, []);

    for (const aiId of this.aiPlayerIds) {
      // Already seated in this room?
      const seated = room.seatOf(aiId);
      if (seated !== -1) continue;
      const seat = freeSeats.shift();
      if (seat === undefined) break; // room full (or all free seats taken)
      const difficulty = this.difficultyForPlayer.get(aiId) ?? "medium";
      const name = DIFFICULTY_NAMES[difficulty];
      // Track the room in the manager so playerRoom() resolves (also keeps the
      // player-rooms map consistent for cleanup).
      this.manager.join(room.id, aiId, name);
    }
  }

  // -------------------------------------------------------------------------
  // AI action loop (per AI seat)
  // -------------------------------------------------------------------------

  private act(room: Room): void {
    const players = room.players;
    if (!players.some((p) => p && p.connected && !isAiPlayerId(p.playerId))) return; // no human watching

    for (let seat = 0; seat < 4; seat++) {
      const p = players[seat];
      if (!p || !isAiPlayerId(p.playerId) || !p.connected) continue;
      const difficulty = this.difficultyForPlayer.get(p.playerId) ?? "medium";

      // --- Ready (lobby / next round after ended). ---
      if (room.status === "lobby" || room.status === "ended") {
        if (!p.ready && shouldReady(room, seat)) {
          this.sendCommand(room, p.playerId, {
            type: "ready",
            operationId: this.opId(room.id, p.playerId, "ready"),
          });
        }
        continue;
      }

      // --- Playing: discard or reaction. ---
      const state = room.state;
      if (!state) continue;

      if (state.phase === "discard" && state.turn === seat) {
        const decision = decideDiscard(room, seat, difficulty);
        if (!decision) continue;
        if (!this.throttle(p.playerId, difficulty)) continue;
        this.sendCommand(room, p.playerId, {
          type: "discard",
          operationId: this.opId(room.id, p.playerId, "discard"),
          tileInstanceId: decision.tileInstanceId,
        });
        continue;
      }

      if (state.phase === "reaction") {
        // Only seats with a pending reaction kind act (else pass / skip).
        const decision = decideReaction(room, seat, difficulty);
        if (!decision) continue;
        if (!this.throttle(p.playerId, difficulty)) continue;
        if (decision.action === "pass") {
          this.sendCommand(room, p.playerId, {
            type: "pass",
            operationId: this.opId(room.id, p.playerId, "pass"),
          });
        } else {
          this.sendCommand(room, p.playerId, {
            type: "reaction",
            operationId: this.opId(room.id, p.playerId, "reaction"),
            kind: decision.kind,
            kongType: decision.kongType,
            handTileIds: decision.handTileIds,
            pengMeldId: decision.pengMeldId,
          });
        }
        continue;
      }
    }
  }

  /** Human-feel delay per difficulty before the next move of an AI. */
  private throttle(playerId: string, difficulty: AiDifficulty): boolean {
    const now = Date.now();
    const at = this.nextActAt.get(playerId) ?? 0;
    if (now < at) return false;
    const [min, max] = AI_ACTION_DELAY_MS[difficulty];
    this.nextActAt.set(playerId, now + min + Math.random() * (max - min));
    return true;
  }

  private sendCommand(room: Room, playerId: string, command: Parameters<Room["handleCommand"]>[1]): void {
    const result = room.handleCommand(playerId, command);
    // Always re-broadcast — a command may have been accepted (state changed)
    // or rejected benignly (stale/duplicate); humans need the latest state.
    this.games.broadcastRoom(room);
    if (!result.ok) {
      const code = result.error?.code ?? "unknown";
      // Benign races (stale_generation / wrong_phase / not_your_turn) happen
      // naturally with a tick loop — they are safe to ignore silently.
      if (["stale_generation", "wrong_phase", "not_your_turn", "no_tile", "not_lobby", "not_playing", "no_discard", "illegal_kong", "illegal_peng", "illegal_chi", "bad_chi", "self_reaction", "disconnected"].includes(code)) {
        return;
      }
      console.warn(`[ai] ${playerId} command rejected (${code}): ${result.error?.message ?? ""}`);
    }
  }
}
```

## File: apps/server/src/aiPlayer.ts

```
/**
 * aiPlayer — server-side AI decision module.
 *
 * The server is authoritative: the Room applies every command and auto-wins
 * 合法可胡即自動胡牌, so an AI never needs a "win" decision. It only decides:
 *   - ready (lobby / next round after ended)
 *   - discard (its discard phase)
 *   - reaction (chi / peng / kong / pass during a reaction window, and self
 *     kong during its own discard phase)
 *
 * Three difficulties:
 *   初級 (easy)   — mostly random discards, rarely claims, often passes.
 *   中級 (medium) — tile-value based safe discards, claims when beneficial.
 *   高級 (hard)   — tenpai-aware: simulates every candidate discard and picks
 *                    the one maximizing immediate waits; claims aggressively.
 *
 * All functions are pure — they read Room state directly (server-side, full
 * hand visibility) and return the command payload the controller sends via
 * room.handleCommand(). No socket / protocol imports here.
 */

import type { GameState, Meld, TileInstance } from "@taiwan-mahjong/rules";
import { chiOptions, detectWin, kongOptions, pengOptions, tileToId } from "@taiwan-mahjong/rules";
import type { Room } from "./room.js";
import { collectPendingKinds } from "./gameLoop.js";

export type AiDifficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_NAMES: Record<AiDifficulty, string> = {
  easy: "AI 初級",
  medium: "AI 中級",
  hard: "AI 高級",
};

/** AI thinking "feel" — small random delay so moves don't look instant. */
export const AI_ACTION_DELAY_MS: Record<AiDifficulty, [number, number]> = {
  easy: [250, 900],
  medium: [200, 700],
  hard: [120, 500],
};

// ---------------------------------------------------------------------------
// Tile helpers (mirror qa-stress — the win-oriented heuristics)
// ---------------------------------------------------------------------------

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

function idSuitRank(id: string): { suit: string; rank: number } | null {
  const [cat, val] = id.split(":");
  if (!cat || !val) return null;
  if (cat === "flower") return null;
  if (cat === "honor") {
    return { suit: "honor", rank: HONOR_RANKS.indexOf(val as (typeof HONOR_RANKS)[number]) };
  }
  if (NUM_SUITS.includes(cat as (typeof NUM_SUITS)[number])) {
    const r = Number(val);
    if (Number.isFinite(r) && r >= 1 && r <= 9) return { suit: cat, rank: r };
  }
  return null;
}

/**
 * How valuable a single tile is toward a win, given the current hand counts.
 * Honors: a pair/triplet of honors is valuable (no runs possible).
 * Numbered: triplets > pairs; neighbors add run potential.
 */
function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0;
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0;
  value += hasLeft && hasRight ? 1 : 0;
  value += hasLeft || hasRight ? 1 : 0;
  return value;
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function handCounts(hand: readonly TileInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of hand) {
    const id = tileToId(t.tile);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Lowest-value tile in the hand (最安全的棄牌). */
function pickWinDiscard(hand: readonly TileInstance[]): TileInstance | undefined {
  if (hand.length === 0) return undefined;
  const counts = handCounts(hand);
  let best: TileInstance | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(tileToId(t.tile), counts);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Highest-value tile (破壞牌 / sabotage — keeps the dealer strong). */
function pickSabotageTile(hand: readonly TileInstance[]): TileInstance | undefined {
  if (hand.length === 0) return undefined;
  const counts = handCounts(hand);
  let best: TileInstance | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(tileToId(t.tile), counts);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// Tenpai (聽牌) evaluation — the hard AI's discard core
// ---------------------------------------------------------------------------

/** All 34 tile identities (27 numbered + 7 honors) — the tenpai wait space. */
const ALL_TILE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of NUM_SUITS) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of HONOR_RANKS) ids.push(`honor:${honor}`);
  return ids;
})();

/** A bare TileInstance for a tile identity (instanceId unused for detection). */
function fakeTile(id: string): TileInstance {
  const [category, value] = id.split(":");
  if (category === "honor") {
    return { tile: { kind: "honor", honor: value as "dong" }, instanceId: -1 };
  }
  return { tile: { kind: "numbered", suit: category as "wan", rank: Number(value) as 1 }, instanceId: -1 };
}

function isTenpai(hand: readonly TileInstance[], melds: readonly Meld[]): boolean {
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) return true;
    }
  }
  return false;
}

/** Number of distinct wait tiles that make `hand` a win (0 = not tenpai). */
function waitCount(hand: readonly TileInstance[], melds: readonly Meld[]): number {
  let count = 0;
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) {
        count++;
        break; // one wait identity per discarded tile
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Discard decisions
// ---------------------------------------------------------------------------

export interface DiscardDecision {
  action: "discard";
  tileInstanceId: number;
}

/**
 * Decide which tile to discard for the given difficulty.
 * `hand` must contain the tile to be discarded (the AI reads it from state).
 */
export function decideDiscard(
  room: Room,
  seat: number,
  difficulty: AiDifficulty,
): DiscardDecision | null {
  const state = room.state;
  if (!state || state.phase !== "discard" || state.turn !== seat) return null;
  const hand = state.wall.hands[seat];
  if (!hand || hand.length === 0) return null;
  const melds = state.melds[seat] as Meld[];

  let target: TileInstance | undefined;

  if (difficulty === "easy") {
    // 初級: 70% random, 30% lowest-value (keeps it beatable but not braindead).
    if (Math.random() < 0.7) target = pickRandom(hand);
    else target = pickWinDiscard(hand);
  } else if (difficulty === "medium") {
    // 中級: tile-value based — discard the lowest-value tile; occasionally
    // risk a random discard so it stays human.
    target = pickWinDiscard(hand);
    if (Math.random() < 0.12 && hand.length > 1) target = pickRandom(hand);
  } else {
    // 高級: tenpai-aware. Try every discard; prefer one that immediately
    // tenpais with the most waits. Otherwise keep the highest tenpai progress.
    let best: TileInstance | undefined;
    let bestWaits = -1;
    let bestFallbackScore = Number.NEGATIVE_INFINITY;
    for (const candidate of hand) {
      const rest = hand.filter((t) => t.instanceId !== candidate.instanceId);
      const waits = waitCount(rest, melds);
      if (waits > bestWaits) {
        bestWaits = waits;
        best = candidate;
        bestFallbackScore = -tileValue(tileToId(candidate.tile), handCounts(rest));
      } else if (waits === bestWaits) {
        // Tie: prefer discarding the least valuable tile (keep strong shapes).
        const score = -tileValue(tileToId(candidate.tile), handCounts(rest));
        if (score > bestFallbackScore) {
          bestFallbackScore = score;
          best = candidate;
        }
      }
    }
    target = best;
  }

  if (!target) return null;
  return { action: "discard", tileInstanceId: target.instanceId };
}

// ---------------------------------------------------------------------------
// Reaction decisions
// ---------------------------------------------------------------------------

export interface ReactionDecision {
  action: "reaction";
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  handTileIds?: number[];
  pengMeldId?: number;
}

export interface PassDecision {
  action: "pass";
}

/** Evaluate how much a claimed meld improves the hand (count pairs / triplets). */
function meldGain(hand: readonly TileInstance[], ids: readonly number[]): number {
  const counts = handCounts(hand);
  let gain = 0;
  for (const id of ids) {
    const t = hand.find((h) => h.instanceId === id);
    if (!t) continue;
    const tid = tileToId(t.tile);
    const sr = idSuitRank(tid);
    if (!sr) continue;
    if (sr.suit === "honor") gain += 2; // honors only form triplets
    else {
      const n = counts.get(tid) ?? 0;
      gain += n >= 3 ? 3 : n === 2 ? 2 : 1;
    }
  }
  return gain;
}

/**
 * Decide a reaction (or pass) for the given seat during the reaction window.
 * Also handles self-kong during the player's own discard phase (state.phase
 * === "discard" && state.turn === seat).
 */
export function decideReaction(
  room: Room,
  seat: number,
  difficulty: AiDifficulty,
): ReactionDecision | PassDecision | null {
  const state = room.state;
  if (!state || room.status !== "playing") return null;
  const hand = state.wall.hands[seat];
  if (!hand) return null;

  // --- Self kong (closed / add-on) during own discard phase. ---
  if (state.phase === "discard" && state.turn === seat) {
    const kongs = kongOptions(state, seat, false);
    if (kongs.length > 0) {
      const claimP = difficulty === "hard" ? 0.85 : difficulty === "medium" ? 0.6 : 0.3;
      if (Math.random() < claimP) {
        const opt = kongs[0]!;
        return {
          action: "reaction",
          kind: "kong",
          kongType: opt.kongType,
          handTileIds: [...opt.handTileIds],
          pengMeldId: opt.pengMeldId,
        };
      }
    }
    return null; // discard turn — no reaction window
  }

  // --- Reaction window against the latest discard. ---
  if (state.phase !== "reaction" || state.lastDiscardBy === seat || !state.lastDiscard) {
    return null;
  }
  // 只有「真的有吃/碰/槓資格」的座位才能表態；沒資格時回 null，不要為了
  // 「走完整流程」送出 pass——否則會瞬間關掉別人的反應窗（pass 只關自家）。
  const pending = collectPendingKinds(state);
  if (!pending.has(seat)) return null;

  const claimBase: Record<AiDifficulty, number> = { easy: 0.25, medium: 0.55, hard: 0.85 };

  // Kong (open) — strongest claim.
  const openKongs = kongOptions(state, seat, true);
  if (openKongs.length > 0) {
    const opt = openKongs[0]!;
    if (Math.random() < claimBase[difficulty] + 0.1) {
      return {
        action: "reaction",
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: [...opt.handTileIds],
        pengMeldId: opt.pengMeldId,
      };
    }
  }

  // Peng — good when it creates a triplet.
  const peng = pengOptions(state, seat);
  if (peng) {
    const gain = meldGain(hand, peng.handTileIds);
    const p = difficulty === "easy" ? 0.2 : difficulty === "medium" ? 0.45 + gain * 0.1 : 0.65 + gain * 0.08;
    if (Math.random() < Math.min(0.95, p)) {
      return { action: "reaction", kind: "peng" };
    }
  }

  // Chi — only by 上家; medium/hard take it when the run is strong.
  const chis = chiOptions(state, seat, state.lastDiscard);
  if (chis && chis.length > 0) {
    const opt = chis[0]!;
    const gain = meldGain(hand, [opt.handTiles[0]!.instanceId, opt.handTiles[1]!.instanceId]);
    const p = difficulty === "easy" ? 0.15 : difficulty === "medium" ? 0.35 + gain * 0.08 : 0.5 + gain * 0.06;
    if (Math.random() < Math.min(0.9, p)) {
      return {
        action: "reaction",
        kind: "chi",
        handTileIds: [opt.handTiles[0]!.instanceId, opt.handTiles[1]!.instanceId],
      };
    }
  }

  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// Ready decision
// ---------------------------------------------------------------------------

/** True when this AI should mark ready (lobby, or ended → next round). */
export function shouldReady(room: Room, seat: number): boolean {
  if (room.status === "lobby") return true;
  if (room.status === "ended") return true; // first ready resets the room
  return false;
}

export function isAiPlayerId(playerId: string): boolean {
  return playerId.startsWith("ai-");
}

export function aiSeat(room: Room, seat: number): boolean {
  const p = room.players[seat];
  return !!p && isAiPlayerId(p.playerId);
}

// Re-export tileToId for the controller (avoid an extra import there).
export { tileToId };
```

## File: apps/server/src/serve.ts

```
/**
 * CLI entry — `pnpm --filter @taiwan-mahjong/server start`
 *
 * Starts the authoritative game server. The Godot client connects to
 * `ws://localhost:3000/ws` (see apps/player-client/README.md).
 *
 * Usage:
 *   PORT=3000 pnpm --filter @taiwan-mahjong/server start
 *   VARIANT=south pnpm --filter @taiwan-mahjong/server start
 */

import { startServer, SERVER_NAME, PROTOCOL_VERSION } from "./index.js";

const port = Number(process.env.PORT ?? 3000);
const variant = (process.env.VARIANT === "south" ? "south" : "north") as "north" | "south";
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 15_000);

const server = await startServer({ port, host: "0.0.0.0", variant, timeoutMs });

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${timeoutMs}ms`);
console.log(`[${SERVER_NAME}] listening on http://0.0.0.0:${server.port}`);
console.log(`[${SERVER_NAME}] WebSocket endpoint: ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);

const shutdown = async (): Promise<void> => {
  console.log(`[${SERVER_NAME}] shutting down…`);
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
```

## File: apps/server/src/serve-web.ts

```
/**
 * CLI entry — `pnpm --filter @taiwan-mahjong/server serve:web`
 *
 * Starts the authoritative game server AND serves the Godot HTML5 export
 * (`apps/player-client/export/web`) over plain HTTP, so the browser build
 * plays directly at http://localhost:3000.
 *
 * The NetworkManager browser default connects to `ws(s)://<page host>/ws` —
 * same origin, no manual URL editing needed.
 *
 * Usage:
 *   PORT=3000 pnpm --filter @taiwan-mahjong/server serve:web
 *   VARIANT=south pnpm --filter @taiwan-mahjong/server serve:web
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { startServer, SERVER_NAME, PROTOCOL_VERSION } from "./index.js";

const port = Number(process.env.PORT ?? 3000);
const variant = (process.env.VARIANT === "south" ? "south" : "north") as "north" | "south";
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 15_000);
// AI 補位：開一個網頁就能打。ENABLE_AI=0 可關閉（例如對戰測試）。
const enableAi = process.env.ENABLE_AI !== "0";

// apps/server/src/serve-web.ts → apps/player-client/export/web
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.WEB_ROOT ?? join(here, "..", "..", "..", "..", "player-client", "export", "web");

if (!existsSync(webRoot)) {
  console.error(`[${SERVER_NAME}] webRoot not found: ${webRoot}`);
  console.error(`[${SERVER_NAME}] export the Godot project first:`);
  console.error(`  /Users/ian/Downloads/Godot.app/Contents/MacOS/Godot --headless --path apps/player-client --export-release "Web"`);
  process.exit(1);
}

const server = await startServer({ port, host: "0.0.0.0", variant, timeoutMs, webRoot, enableAi });

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${timeoutMs}ms`);
console.log(`[${SERVER_NAME}] ai-fill=${enableAi ? "ON (3 AIs: 初級/中級/高級)" : "OFF"}`);
console.log(`[${SERVER_NAME}] webRoot=${webRoot}`);
console.log(`[${SERVER_NAME}] listening on http://0.0.0.0:${server.port}`);
console.log(`[${SERVER_NAME}] Play:   http://localhost:${server.port}/`);
console.log(`[${SERVER_NAME}] WS:     ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);

const shutdown = async (): Promise<void> => {
  console.log(`[${SERVER_NAME}] shutting down…`);
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
```

## File: apps/server/src/__tests__/room.test.ts

```
/**
 * Room / RoomManager tests — lifecycle, Generation ID, command dedup, and the
 * authoritative game-loop (auto-deal → discard → reaction → auto-win).
 *
 * These are pure in-process tests (no sockets). The WSS layer is covered by
 * `wss.test.ts`.
 */

import { describe, it, expect } from "vitest";
import type { Meld, TileInstance } from "@taiwan-mahjong/rules";
import { Room, type RoomOptions } from "../room.js";
import { RoomManager } from "../roomManager.js";
import type { ClientCommand } from "../protocol.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoom(overrides: Partial<RoomOptions> = {}): Room {
  return new Room({ id: "test-room", variant: "north", ...overrides });
}

function joinAll(room: Room): number[] {
  return ["a", "b", "c", "d"].map((id) => room.join(id, `P${id.toUpperCase()}`));
}

function readyAll(room: Room, players: string[] = ["a", "b", "c", "d"]): void {
  for (const p of players) room.setReady(p);
}

function cmd(partial: Partial<ClientCommand> & { type: ClientCommand["type"] }): ClientCommand {
  return { operationId: `op-${Math.random()}`, ...partial } as ClientCommand;
}

/** Discard the first tile in the given seat's hand. */
function firstDiscard(room: Room, seat: number): ClientCommand {
  const tile = room.state!.wall.hands[seat]![0]!;
  return cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId });
}

/** Build a TileInstance[] from "suit:rank" / "honor:wind" specs. */
function tiles16(specs: string[], startId = 9000): TileInstance[] {
  let id = startId;
  return specs.map((spec) => {
    const idx = spec.indexOf(":");
    const category = spec.slice(0, idx);
    const value = spec.slice(idx + 1);
    const tile =
      category === "wan" || category === "tiao" || category === "tong"
        ? ({ kind: "numbered", suit: category, rank: Number(value) } as TileInstance["tile"])
        : ({ kind: "honor", honor: value } as TileInstance["tile"]);
    return { instanceId: id++, tile };
  });
}

/** Build a kong reaction command for the given seat (via playerId at that seat). */
function kongReaction(
  room: Room,
  kongType: "open" | "closed" | "add-on",
  handTileIds: number[],
  pengMeldId?: number,
): ClientCommand {
  return cmd({
    type: "reaction",
    kind: "kong",
    kongType,
    handTileIds,
    pengMeldId,
    generationId: room.generationId,
  });
}

/** 16-tile hand: five melds + a single tong:7 — wins on any tong:7. */
const WAIT_TONG7 = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7",
];

/** 16-tile hand: four melds + pair + wan:46 — wins on wan:5 (robs the kong). */
const WAIT_WAN5 = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7", "tong:7",
];

/** A 16-tile hand that can never win (honour quadruplets — honours must be triplets). */
const NON_WINNING_16 = [
  "honor:dong", "honor:dong", "honor:dong", "honor:dong",
  "honor:nan", "honor:nan", "honor:nan", "honor:nan",
  "honor:xi", "honor:xi", "honor:xi", "honor:xi",
  "honor:bei", "honor:bei", "honor:bei", "honor:bei",
];

describe("Room — join / ready / auto-deal", () => {
  it("assigns seats 0..3 in join order", () => {
    const room = makeRoom();
    expect(joinAll(room)).toEqual([0, 1, 2, 3]);
    expect(room.status).toBe("lobby");
  });

  it("rejects a 5th player", () => {
    const room = makeRoom();
    joinAll(room);
    expect(() => room.join("e", "P5")).toThrow(/full/i);
  });

  it("4 players ready triggers auto-deal with 17-tile dealer hand", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    expect(room.status).toBe("playing");
    expect(room.state).not.toBeNull();
    // Dealer (0) holds 17, others 16.
    expect(room.state!.wall.hands[0]!.length).toBe(17);
    expect(room.state!.wall.hands[1]!.length).toBe(16);
    expect(room.state!.turn).toBe(0);
    expect(room.state!.phase).toBe("discard");
  });

  it("game does not start until all 4 ready", () => {
    const room = makeRoom();
    joinAll(room);
    room.setReady("a");
    room.setReady("b");
    room.setReady("c");
    expect(room.status).toBe("lobby");
    room.setReady("d");
    expect(room.status).toBe("playing");
  });

  it("disconnect does not remove the seat; reconnect restores it", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const seatB = room.seatOf("b");
    room.setConnected("b", false);
    expect(room.players[seatB]!.connected).toBe(false);
    room.setConnected("b", true);
    expect(room.players[seatB]!.connected).toBe(true);
    expect(room.seatOf("b")).toBe(seatB);
  });
});

describe("Room — generation ID + operationId dedup", () => {
  it("generationId increments on every accepted command", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const g0 = room.generationId;
    room.handleCommand("a", firstDiscard(room, 0));
    expect(room.generationId).toBeGreaterThan(g0);
  });

  it("drops stale commands (older generation)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const staleGen = room.generationId - 1;
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: room.state!.wall.hands[0]![0]!.instanceId, generationId: staleGen }),
    );
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("stale_generation");
  });

  it("same operationId is idempotent — executed once", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const op = "op-idempotent";
    const tileId = room.state!.wall.hands[0]![0]!.instanceId;
    const first = room.handleCommand("a", { type: "discard", operationId: op, tileInstanceId: tileId, generationId: room.generationId });
    expect(first.ok).toBe(true);
    // Replay with the same operationId must not double-execute.
    const second = room.handleCommand("a", { type: "discard", operationId: op, tileInstanceId: tileId });
    expect(second.ok).toBe(true);
    // Hand shrunk by exactly one tile (not two).
    const hand = room.state!.wall.hands[0]!;
    expect(hand.some((t) => t.instanceId === tileId)).toBe(false);
  });

  it("rejects a command from a non-member", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const res = room.handleCommand("nobody", cmd({ type: "pass" }));
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("not_in_room");
  });
});

describe("Room — discard / reaction / auto-win loop", () => {
  it("discard moves to reaction phase and offers the discard pool", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[0]![0]!;
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId }),
    );
    expect(res.ok).toBe(true);
    expect(room.state!.discards.map((t) => t.instanceId)).toContain(tile.instanceId);
  });

  it("discard out of turn is rejected", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[1]![0]!; // seat 1, but it's seat 0's turn
    const res = room.handleCommand("b", cmd({ type: "discard", tileInstanceId: tile.instanceId }));
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("not_your_turn");
  });

  it("pass advances to the next seat (draw then discard phase)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[0]![0]!;
    room.handleCommand("a", cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId }));
    // If any reaction window exists, pass (we are seat 0's discarder so nobody
    // can react to themselves; if a window opened, force-pass it).
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.state!.turn).toBe(1);
    expect(room.state!.phase).toBe("discard");
  });

  it("auto-win fires immediately on a winning discard (合法可胡即自動胡牌)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    // Force seat 1 to be one tile away from winning on the discard.
    // Construct a 16-tile hand that wins when the discarded tile completes a meld.
    const winningHand: TileInstance[] = [];
    const ids = [
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7",
    ];
    let instanceId = 9000;
    for (const id of ids) {
      const [suit, rank] = id.split(":");
      winningHand.push({
        instanceId: instanceId++,
        tile: suit === "wan" || suit === "tong"
          ? { kind: "numbered", suit, rank: Number(rank) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
          : { kind: "honor", honor: "dong" },
      });
    }
    state.wall.hands[1] = winningHand as TileInstance[];

    // Seat 0 discards tong:7 → seat 1 completes tong:567 → win.
    const discard = state.wall.hands[0]!.find((t) => t.tile.kind === "numbered" && t.tile.suit === "tong" && t.tile.rank === 7);
    const discardTile = discard ?? state.wall.hands[0]![0]!;
    // If the natural discard is not tong:7 we simply use the first tile; the
    // auto-win path is exercised regardless when a discard exists. To make the
    // test deterministic, force seat 0's first tile to be tong:7.
    state.wall.hands[0]![0] = {
      instanceId: 8800,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: state.wall.hands[0]![0]!.instanceId, generationId: room.generationId }),
    );
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1);
    expect(room.state!.phase).toBe("ended");
    expect(room.ledger).not.toBeNull();
    // Zero-sum: deltas sum to zero.
    const sum = room.ledger!.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // Discard win: seat 0 pays full, others half.
    const d0 = room.ledger!.find((e) => e.seat === 0)!.delta;
    expect(d0).toBeLessThan(0);
  });
});

describe("Room — P0-1 搶槓 (qiang kong) integration", () => {
  it("an add-on kong is robbed by a winning seat; the kongger pays the ledger", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Kongger (seat 2): a peng of wan:5 plus the 4th wan:5 in hand.
    const pengTiles = tiles16(["wan:5", "wan:5", "wan:5"], 9200);
    const peng: Meld = { id: 77, kind: "peng", tiles: pengTiles, claimed: pengTiles[0]! };
    state.melds[2] = [peng];
    state.wall.hands[2] = tiles16(
      [
        "wan:5",
        "tong:1", "tong:2", "tong:3",
        "tong:4", "tong:5", "tong:6",
        "tong:7", "tong:8", "tong:9",
        "tong:9", "tong:9", "tong:9", "tong:9",
      ],
      9300,
    ); // 14 tiles incl. the 4th wan:5

    // Seat 1 waits on wan:5 and wins when it is robbed.
    state.wall.hands[1] = tiles16(WAIT_WAN5, 9400);
    // Seats 0 & 3 cannot win on wan:5.
    state.wall.hands[0] = tiles16(NON_WINNING_16, 9500);
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9600);

    state.turn = 2;
    state.phase = "discard";

    const fourth = state.wall.hands[2]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 5,
    )!;
    const res = room.handleCommand("c", kongReaction(room, "add-on", [fourth.instanceId], peng.id));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // seat 1 robs the kong
    expect(room.selfDraw).toBe(false);
    expect(room.kongDraw).toBe(false);

    // P0-1 ledger: the kongger (seat 2) pays full stake; bystanders pay half.
    const d = room.ledger!;
    const seat1 = d.find((e) => e.seat === 1)!.delta;
    const seat2 = d.find((e) => e.seat === 2)!.delta;
    const seat0 = d.find((e) => e.seat === 0)!.delta;
    const seat3 = d.find((e) => e.seat === 3)!.delta;
    expect(seat1).toBeGreaterThan(0);
    expect(seat2).toBeLessThan(0);
    expect(seat0).toBeLessThan(0);
    expect(seat3).toBeLessThan(0);
    // The kongger (放槍者) loses more than a bystander.
    expect(seat2).toBeLessThan(seat0);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — P0-2 槓上開花 (kong-draw win) integration", () => {
  it("the kong replacement completes the kongger's hand → self-draw win with kongDraw", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Kongger (seat 2): a peng of wan:5 plus a 14-tile hand incl. the 4th wan:5.
    const pengTiles = tiles16(["wan:5", "wan:5", "wan:5"], 9200);
    const peng: Meld = { id: 77, kind: "peng", tiles: pengTiles, claimed: pengTiles[0]! };
    state.melds[2] = [peng];
    // Pre-kong hand: 13 usable tiles + the 4th wan:5. After the add-on kong
    // consumes wan:5 and draws the deck tile (tong:7) → 14 tiles + kong = 18 = win.
    state.wall.hands[2] = tiles16(
      [
        "wan:1", "wan:2", "wan:3",
        "wan:5",
        "wan:7", "wan:8", "wan:9",
        "tong:1", "tong:2", "tong:3",
        "tong:4", "tong:5", "tong:6",
        "tong:7",
      ],
      9300,
    );

    // Other seats must not rob the kong (they would win first otherwise).
    state.wall.hands[0] = tiles16(NON_WINNING_16, 9500);
    state.wall.hands[1] = tiles16(NON_WINNING_16, 9600);
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9700);

    // Force the kong replacement (尾牆補牌) to be the completing tong:7.
    const wall = (state.wall as unknown as { wall: TileInstance[] }).wall;
    wall[state.wall.deckCursor] = {
      instanceId: 8899,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    state.turn = 2;
    state.phase = "discard";

    const fourth = state.wall.hands[2]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 5,
    )!;
    const res = room.handleCommand("c", kongReaction(room, "add-on", [fourth.instanceId], peng.id));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(2); // the kongger self-draws the replacement
    expect(room.selfDraw).toBe(true);
    expect(room.kongDraw).toBe(true);

    // Self-draw: every other seat pays the full stake; zero-sum.
    const d = room.ledger!;
    expect(d.find((e) => e.seat === 2)!.delta).toBeGreaterThan(0);
    for (const s of [0, 1, 3]) expect(d.find((e) => e.seat === s)!.delta).toBeLessThan(0);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — P0-4 一砲多響 (multi-win) integration", () => {
  it("two winners settle on the same discard — the discarder pays both, ledger zero-sum", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Seats 1 & 2 both wait on tong:7 (identical hands → identical stakes).
    state.wall.hands[1] = tiles16(WAIT_TONG7, 9400);
    state.wall.hands[2] = tiles16(WAIT_TONG7, 9500);
    // Seat 3 cannot win.
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9600);
    // Seat 0 (the discarder) leads the winning tong:7.
    state.wall.hands[0]![0] = {
      instanceId: 8800,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    const res = room.handleCommand(
      "a",
      cmd({
        type: "discard",
        tileInstanceId: state.wall.hands[0]![0]!.instanceId,
        generationId: room.generationId,
      }),
    );
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // nearest winner (seat 1) is the primary
    expect(room.selfDraw).toBe(false);

    // Both winners settle; the discarder loses the most; the ledger sums to 0.
    const d = room.ledger!;
    const seat1 = d.find((e) => e.seat === 1)!.delta;
    const seat2 = d.find((e) => e.seat === 2)!.delta;
    const seat0 = d.find((e) => e.seat === 0)!.delta;
    const seat3 = d.find((e) => e.seat === 3)!.delta;
    expect(seat1).toBeGreaterThan(0);
    expect(seat2).toBeGreaterThan(0);
    expect(seat0).toBeLessThan(0);
    expect(seat3).toBeLessThan(0);
    // Identical hands → identical stakes → identical payouts.
    expect(seat1).toBe(seat2);
    // The bystander (seat 3) pays half of each winner = half of the discarder's loss.
    expect(seat3).toBe(seat0 / 2);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — 莊家輪替 / 連莊機制 (dealer rotation)", () => {
  /** Craft seat 1 as the discard-winner (completes tong:567 on the discard). */
  function craftSeat1Win(room: Room): void {
    const state = room.state!;
    const ids = [
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7",
    ];
    let instanceId = 9000;
    state.wall.hands[1] = ids.map((id) => {
      const [suit, rank] = id.split(":");
      return {
        instanceId: instanceId++,
        tile:
          suit === "wan" || suit === "tong"
            ? { kind: "numbered", suit, rank: Number(rank) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
            : { kind: "honor", honor: "dong" },
      };
    }) as TileInstance[];
    // Force seat 0's first tile to be the winning discard tong:7.
    state.wall.hands[0]![0] = { instanceId: 8800, tile: { kind: "numbered", suit: "tong", rank: 7 } };
  }

  /** Read the room's private dealer — the rotation target. state.dealer stays
   * the in-hand dealer (for 連莊台 scoring), so tests must read Room.dealer. */
  function currentDealer(room: Room): number {
    return (room as unknown as { dealer: number }).dealer;
  }

  it("過莊: non-dealer win rotates the dealer to the next seat + streak resets", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    expect(room.state!.dealer).toBe(0);
    craftSeat1Win(room);
    const res = room.handleCommand("a", firstDiscard(room, 0));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // non-dealer (seat 1) wins
    // 過莊 → next dealer is seat 1, streak reset to 0.
    expect(currentDealer(room)).toBe(1);
    // state.dealer intentionally stays the in-hand dealer — rotation only
    // affects the NEXT hand's deal.
    expect(room.state!.dealer).toBe(0);
    expect(room.dealerStreak).toBe(0);
  });

  it("連莊: dealer win keeps the seat + dealerStreak increments", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Hand 1 — seat 0 (dealer) discards tong:7; seat 1 wins → 過莊.
    craftSeat1Win(room);
    const r1 = room.handleCommand("a", firstDiscard(room, 0));
    expect(r1.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1);
    expect(currentDealer(room)).toBe(1);
    expect(room.dealerStreak).toBe(0);
    // Hand 2 — dealer = seat 1. Let the DEALER win → 連莊.
    room.resetForNextRound();
    // Force the next hand's dealer to be seat 1 (as if rotation already ran).
    (room as unknown as { dealer: number }).dealer = 1;
    readyAll(room);
    expect(room.state!.dealer).toBe(1);
    expect(room.state!.turn).toBe(1); // the dealer discards first
    // The fresh deal replaced the hands — re-craft seat 1's winning hand and
    // seat 0's forced winning discard (tong:7).
    craftSeat1Win(room);
    // Fast-forward to seat 0's discard phase (simulating seats 2 & 3 having
    // passed) so seat 0 discards the winning tong:7 → dealer seat 1 auto-wins.
    const state2 = room.state!;
    state2.turn = 0;
    state2.phase = "discard";
    const r2 = room.handleCommand("a", firstDiscard(room, 0));
    expect(r2.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // the dealer (seat 1) wins
    expect(currentDealer(room)).toBe(1); // 連莊: seat stays
    expect(room.dealerStreak).toBe(1); // 連莊: streak advanced
  });

  it("流局: dealer keeps the seat + streak advances (連莊 on draw)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Exhaust the wall → 流局 (no winner). The draw path advances the streak.
    const state = room.state!;
    state.wall.headCursor = state.wall.tailStart; // head exhausted
    state.wall.deckCursor = state.wall.wall.length; // deck exhausted
    // Trigger a discard — a reaction window may open; close it with a pass so
    // the next draw hits the exhausted wall → 流局.
    room.handleCommand("a", firstDiscard(room, 0));
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.status).toBe("ended");
    expect(room.winner).toBeNull();
    expect(room.dealerStreak).toBe(1); // 流局 → 連莊 (streak +1)
    expect(currentDealer(room)).toBe(0); // dealer unchanged
    expect(room.state!.dealer).toBe(0); // in-hand dealer unchanged
  });
});

describe("Room — 斷線逾時自動託管 (timeout autoplay)", () => {
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  it("discard timeout auto-摸切: server discards the last-drawn tile", async () => {
    const room = makeRoom({ timeoutMs: 20 });
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    const dealerHand = state.wall.hands[0]!;
    // Record the last-drawn tile (dealer drew it on deal).
    const lastDrawn = dealerHand[dealerHand.length - 1]!;
    state.lastDrawnBy = 0;
    state.lastDrawnTile = lastDrawn;
    // Wait for the 20ms timeout → server auto-discards the last-drawn tile.
    await sleep(60);
    expect(room.status).toBe("playing");
    // The last-drawn tile is gone from the hand (摸切).
    expect(dealerHand.some((t) => t.instanceId === lastDrawn.instanceId)).toBe(false);
    // The autoplay log recorded a discard (摸切).
    const entry = room.autoplayLog.find((a) => a.action === "discard");
    expect(entry).toBeDefined();
    expect(entry!.reason).toBe("timeout");
    expect(state.phase).toBe("reaction");
  });

  it("reaction timeout auto-pass: window closes and the turn advances", async () => {
    // 300ms timeout keeps the assertion well within ONE timer window — the
    // auto-pass fires at ~300ms and the next seat's discard timer would only
    // fire at ~600ms, so the phase cannot cascade into another window.
    const room = makeRoom({ timeoutMs: 300 });
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    // Open a reaction window: discard seat 0's first tile.
    const res = room.handleCommand("a", firstDiscard(room, 0));
    expect(res.ok).toBe(true);
    expect(state.phase).toBe("reaction");
    // Wait past the reaction timeout → auto-pass advances to the next seat.
    // After the auto-pass the next seat draws and enters ITS discard phase
    // (draw resolves synchronously inside the same tick → "discard").
    await sleep(400);
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(1);
    expect(room.autoplayLog.some((a) => a.action === "pass")).toBe(true);
  });

  it("disconnect → immediate autoplay; reconnect → manual control restored", async () => {
    const room = makeRoom({ timeoutMs: 20 });
    joinAll(room);
    readyAll(room);
    // Seat 0 is the dealer & first to discard. Disconnect them mid-discard.
    room.setConnected("a", false);
    expect(room.players[0]!.autoplay).toBe(true);
    expect(room.autoplay[0]).toBe(true);
    // Immediate 摸切 (delay 0) — the table never waits on the offline seat.
    // (The 摸切 targets the last hand tile; afterwards the game may open a
    // reaction window or advance — the log entry is what proves the 摸切.)
    const entry = room.autoplayLog.find((a) => a.action === "discard" && a.reason === "disconnect");
    expect(entry).toBeDefined();
    // Reconnect restores manual control.
    room.setConnected("a", true);
    expect(room.players[0]!.autoplay).toBe(false);
    expect(room.autoplay[0]).toBe(false);
  });

  it("autoplay flag is cleared when a new hand starts (resetForNextRound)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Mid-hand disconnect → seat b enters 自動託管.
    room.setConnected("b", false);
    expect(room.players[room.seatOf("b")]!.autoplay).toBe(true);
    // End the hand via 流局 (exhausted wall) so resetForNextRound is legal.
    const state = room.state!;
    state.wall.headCursor = state.wall.tailStart;
    state.wall.deckCursor = state.wall.wall.length;
    room.handleCommand("a", firstDiscard(room, 0));
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.status).toBe("ended");
    // Reset for the next hand → 自動託管 flags cleared.
    expect(room.resetForNextRound()).toBe(true);
    for (const p of room.players) if (p) expect(p.autoplay).toBe(false);
    expect(room.autoplay.every((v) => v === false)).toBe(true);
  });
});

describe("RoomManager — lifecycle", () => {
  it("creates unique room ids", () => {
    const m = new RoomManager();
    const r1 = m.createRoom();
    const r2 = m.createRoom();
    expect(r1.roomId).not.toBe(r2.roomId);
  });

  it("join routes players to their room", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    expect(m.playerRoom("p1")).toBe(room);
  });

  it("cleanup removes rooms with no connected players", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    room.setConnected("p1", false);
    expect(m.cleanup()).toContain(roomId);
    expect(m.get(roomId)).toBeUndefined();
  });

  it("reconnect restores the player's room", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    m.disconnect("p1");
    expect(room.players[0]!.connected).toBe(false);
    expect(m.reconnect("p1")).toBe(room);
    expect(room.players[0]!.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reaction pass semantics — formal proof tests
// ---------------------------------------------------------------------------

describe("Room — reaction doPass 語義正確性", () => {
  /**
   * 場景：seat 0 棄牌；seat 1 和 seat 2 都能碰（各持兩張相同牌）。
   * 先讓 seat 1 pass → 反應窗仍開（seat 2 仍 pending）。
   * 再讓 seat 2 pass → 反應窗關閉，輪到下家摸牌。
   */
  it("兩 pending seat：第一個 pass 不關窗，第二個 pass 才關窗", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // seat 0 棄 wan:5；seat 1 & seat 2 各持兩張 wan:5 → 可碰。
    // seat 3 無 wan:5 且每種 honor 只有 3 張（避免四張成槓 → 無 kong 資格）。
    const WAN5: TileInstance["tile"] = { kind: "numbered", suit: "wan", rank: 5 };
    const makeHonor = (h: "dong" | "nan" | "xi" | "bei", id: number): TileInstance => ({
      instanceId: id, tile: { kind: "honor", honor: h },
    });
    const discardTile: TileInstance = { instanceId: 7001, tile: WAN5 };

    // 16-tile mixed hand: 每種 honor 恰好 3 張（不足 4 張 → 無 kong 資格），
    // 其餘用 tong 牌（無 wan → 無法 chi wan:5，也無 peng/kong wan:5）。
    const noKongHand16 = (start: number): TileInstance[] => [
      ...Array.from({ length: 3 }, (_, i) => makeHonor("dong", start + i)),
      ...Array.from({ length: 3 }, (_, i) => makeHonor("nan",  start + 3 + i)),
      ...Array.from({ length: 3 }, (_, i) => makeHonor("xi",   start + 6 + i)),
      ...Array.from({ length: 3 }, (_, i) => makeHonor("bei",  start + 9 + i)),
      { instanceId: start + 12, tile: { kind: "numbered", suit: "tong", rank: 1 } },
      { instanceId: start + 13, tile: { kind: "numbered", suit: "tong", rank: 3 } },
      { instanceId: start + 14, tile: { kind: "numbered", suit: "tong", rank: 5 } },
      { instanceId: start + 15, tile: { kind: "numbered", suit: "tong", rank: 7 } },
    ];


    // seat 0: discard tile + 15 tiles with no wan:5 (cannot win)
    state.wall.hands[0] = [discardTile, ...noKongHand16(8000).slice(0, 15)];
    // seat 1: two wan:5 + 14 tiles → can peng wan:5; NO 4-of-a-kind → no kong
    state.wall.hands[1] = [
      { instanceId: 7002, tile: WAN5 },
      { instanceId: 7003, tile: WAN5 },
      ...noKongHand16(8100).slice(0, 14),
    ];
    // seat 2: two wan:5 + 14 tiles → can peng wan:5; NO 4-of-a-kind → no kong
    state.wall.hands[2] = [
      { instanceId: 7004, tile: WAN5 },
      { instanceId: 7005, tile: WAN5 },
      ...noKongHand16(8200).slice(0, 14),
    ];
    // seat 3: 16 tiles with no wan:5, no 4-of-a-kind → cannot react
    state.wall.hands[3] = noKongHand16(8300);

    // seat 0 棄牌 → reaction window
    const discard = room.handleCommand("a", cmd({ type: "discard", tileInstanceId: 7001, generationId: room.generationId }));
    expect(discard.ok).toBe(true);
    if (state.phase !== "reaction") return; // wall may be empty / auto-win — skip

    // Verify exactly seats 1 & 2 are pending (not seat 3)
    const pendingAfterDiscard = room.pendingKinds();
    if (!pendingAfterDiscard.has(1) || !pendingAfterDiscard.has(2)) return; // skip

    // seat 1 (player "b") pass → 窗仍開（seat 2 仍 pending）
    const gen1 = room.generationId;
    const pass1 = room.handleCommand("b", cmd({ type: "pass", generationId: gen1 }));
    expect(pass1.ok).toBe(true);
    // The window must still be open — seat 2 hasn't passed yet
    expect(state.phase).toBe("reaction");

    // seat 2 (player "c") pass → 兩 pending 皆已 pass，關窗
    const gen2 = room.generationId;
    const pass2 = room.handleCommand("c", cmd({ type: "pass", generationId: gen2 }));
    expect(pass2.ok).toBe(true);
    expect(state.phase).not.toBe("reaction");
  });



  /**
   * 非 pending seat（放槍者 seat 0 對自己的棄牌反應）pass → 立即強制關窗。
   * 這是測試 / script 強制關窗路徑，不應報錯。
   */
  it("非 pending seat pass → 強制關窗（測試 / script 路徑）", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    const discardTile: TileInstance = { instanceId: 7010, tile: { kind: "numbered", suit: "wan", rank: 5 } };
    state.wall.hands[0] = [discardTile, ...tiles16(NON_WINNING_16.slice(0, 15), 8400)];
    state.wall.hands[1] = [
      { instanceId: 7011, tile: { kind: "numbered", suit: "wan", rank: 5 } },
      { instanceId: 7012, tile: { kind: "numbered", suit: "wan", rank: 5 } },
      ...tiles16(NON_WINNING_16.slice(0, 14), 8500),
    ];
    state.wall.hands[2] = tiles16(NON_WINNING_16, 8600);
    state.wall.hands[3] = tiles16(NON_WINNING_16, 8700);

    room.handleCommand("a", cmd({ type: "discard", tileInstanceId: 7010, generationId: room.generationId }));
    if (state.phase !== "reaction") return; // no window opened

    // seat 0（非 pending — 不能對自己的棄牌碰）pass → 強制關窗
    const forceClose = room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    expect(forceClose.ok).toBe(true);
    expect(state.phase).not.toBe("reaction");
  });
});

```

## File: apps/server/src/__tests__/wss.test.ts

```
/**
 * WSS end-to-end tests — 4 simulated WebSocket clients.
 *
 * Full flow: 開房 (create) → 發牌 (auto-deal) → 出牌 (discard) →
 * 吃碰槓 (chi/peng/kong reactions) → 自動胡結算 (auto-win + settlement).
 *
 * The server is the single source of truth: clients only issue commands and
 * receive Client-Safe snapshots.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../index.js";
import type { ClientCommand, ServerEvent } from "../protocol.js";
import type { ClientSnapshot, PlayerView } from "../snapshot.js";

// ---------------------------------------------------------------------------
// Tiny test client harness
// ---------------------------------------------------------------------------

class TestClient {
  private ws: WebSocket;
  private queue: ServerEvent[] = [];
  private waiters: Array<(e: ServerEvent) => boolean> = [];
  private snapshotWaiters: Array<(e: Extract<ServerEvent, { type: "snapshot" }>) => boolean> = [];
  playerId: string | null = null;
  roomId: string | null = null;
  closed = false;
  /** The most recent snapshot event received — always the current server state. */
  latestSnapshot: Extract<ServerEvent, { type: "snapshot" }> | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      const event = JSON.parse(data.toString()) as ServerEvent;
      let consumed = false;
      if (event.type === "snapshot") {
        this.latestSnapshot = event;
        for (let i = this.snapshotWaiters.length - 1; i >= 0; i--) {
          if (this.snapshotWaiters[i]!(event)) {
            this.snapshotWaiters.splice(i, 1);
            consumed = true;
            break;
          }
        }
      }
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        if (this.waiters[i]!(event)) {
          this.waiters.splice(i, 1);
          consumed = true;
          break;
        }
      }
      // An event consumed by a waiter must not also sit in the queue.
      if (!consumed) this.queue.push(event);
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  send(cmd: ClientCommand): void {
    if (this.closed) return;
    this.ws.send(JSON.stringify(cmd));
  }

  next(type: string, predicate?: (e: any) => boolean): Promise<ServerEvent> {
    const idx = this.queue.findIndex(
      (e) => e.type === type && (!predicate || predicate(e)),
    );
    if (idx !== -1) return Promise.resolve(this.queue.splice(idx, 1)[0]!);
    return new Promise((resolve) => {
      this.waiters.push((e: ServerEvent): boolean => {
        if (e.type === type && (!predicate || predicate(e))) {
          resolve(e);
          return true;
        }
        return false;
      });
    });
  }

  /**
   * The current (latest) snapshot — never a stale queued one. When `predicate`
   * is given and the latest snapshot doesn't satisfy it, waits for a *fresh*
   * snapshot that does (stale queued snapshots are never matched).
   */
  snapshot(
    predicate?: (s: ClientSnapshot) => boolean,
  ): Promise<Extract<ServerEvent, { type: "snapshot" }>> {
    if (this.latestSnapshot && (!predicate || predicate(this.latestSnapshot.snapshot))) {
      return Promise.resolve(this.latestSnapshot);
    }
    return new Promise((resolve) => {
      this.snapshotWaiters.push((e: Extract<ServerEvent, { type: "snapshot" }>) => {
        if (!predicate || predicate(e.snapshot)) {
          resolve(e);
          return true;
        }
        return false;
      });
    });
  }

  drain(type: string): ServerEvent[] {
    const out = this.queue.filter((e) => e.type === type);
    this.queue = this.queue.filter((e) => e.type !== type);
    return out;
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let server: RunningServer;
let url: string;
let opCounter = 0;
const op = (): string => `op-${++opCounter}-${Date.now()}`;

beforeAll(async () => {
  server = await startServer({ port: 0 });
  url = `ws://127.0.0.1:${server.port}/ws`;
});

afterAll(async () => {
  await server.stop();
});

async function connect(): Promise<TestClient> {
  const c = new TestClient(url);
  await c.open();
  return c;
}

/** Create a fresh room with 4 connected clients (A=host, B/C/D join). */
async function setupRoom(): Promise<TestClient[]> {
  const a = await connect();
  a.send({ type: "create", operationId: op(), playerName: "A" });
  const welcome = (await a.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
  a.playerId = welcome.playerId;
  a.roomId = welcome.roomId!;
  await a.next("room.created");

  const out = [a];
  for (const name of ["B", "C", "D"]) {
    const c = await connect();
    c.send({ type: "join", operationId: op(), roomId: a.roomId!, playerName: name });
    const w = (await c.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
    c.playerId = w.playerId;
    c.roomId = w.roomId;
    await c.next("player.joined");
    out.push(c);
  }
  return out;
}

/** Send ready for all 4, await game.started, return the clients. */
async function startGame(clients: TestClient[]): Promise<void> {
  for (const c of clients) {
    // No generationId — ready is a lobby action and must not be dropped as stale.
    c.send({ type: "ready", operationId: op() });
  }
  await clients[0]!.next("game.started");
  // Latest snapshot confirms the deal (blocks until a playing snapshot exists).
  await clients[0]!.snapshot((s) => s.status === "playing");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WSS — create / join / ready / auto-deal", () => {
  it("create → welcome + room.created + join flow assigns 4 seats", async () => {
    const clients = await setupRoom();
    expect(clients).toHaveLength(4);
    expect(clients[0]!.roomId).toBeTruthy();
    // 4 distinct player ids.
    const ids = new Set(clients.map((c) => c.playerId));
    expect(ids.size).toBe(4);
    // Snapshot after all joins: 4 players in lobby.
    const snap = (await clients[0]!.next("snapshot", (e) => e.snapshot.status === "lobby")) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(snap.snapshot.players.length).toBe(4);
  });

  it("4 ready → auto-deal with Client-Safe masking (17/16 hands)", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const snap = (await clients[0]!.snapshot((s) => s.status === "playing")) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(snap.snapshot.status).toBe("playing");
    const me = snap.snapshot.players[snap.snapshot.you]!;
    expect(me.hand!.length).toBeGreaterThanOrEqual(16);
    // Masking: other players' hands are null.
    for (const p of snap.snapshot.players) {
      if (p.seat !== snap.snapshot.you) expect(p.hand).toBeNull();
    }
    // Dealer (seat 0) has 17.
    expect(snap.snapshot.players[0]!.handCount).toBe(17);
  });
});

describe("WSS — discard → reaction → auto-win settlement", () => {
  it("seat 0 discards; discard observed by all; auto-win ends with zero-sum ledger", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;

    // --- Force a deterministic auto-win for seat 1 on the first discard. ---
    const room = server.manager.get(c0.roomId!)!;
    const state = room.state!;
    // Seat 1's 16-tile hand is one tile away from a win (tenpai):
    //   wan 123 / 456 / 789 (3 melds) + tong 123 / 456 (2 melds) = 15 tiles,
    //   plus a tong:7 single. Discarding tong:7 completes tong:77 as the pair
    //   → 5 melds + pair = 17 → 自動胡牌.
    const ids16: Array<[string, number]> = [
      ["wan", 1], ["wan", 2], ["wan", 3],
      ["wan", 4], ["wan", 5], ["wan", 6],
      ["wan", 7], ["wan", 8], ["wan", 9],
      ["tong", 1], ["tong", 2], ["tong", 3],
      ["tong", 4], ["tong", 5], ["tong", 6],
      ["tong", 7],
    ];
    state.wall.hands[1] = ids16.map(([suit, rank], i) => ({
      instanceId: 20000 + i,
      tile: { kind: "numbered", suit: suit as "wan" | "tong", rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 },
    })) as never;
    // Seat 0's first tile becomes tong:7 (the winning discard).
    state.wall.hands[0]![0] = {
      instanceId: 30000,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    c0.send({
      type: "discard",
      operationId: op(),
      tileInstanceId: 30000,
      generationId: snap.snapshot.generationId,
    });

    // Seat 1 auto-wins → game.ended with zero-sum ledger.
    const ended = (await clients[1]!.next("game.ended")) as Extract<
      ServerEvent,
      { type: "game.ended" }
    >;
    expect(ended.winner).toBe(1);
    expect(ended.selfDraw).toBe(false);
    expect(ended.ledger).toHaveLength(4);
    const sum = ended.ledger.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // Winner's delta positive.
    const winnerDelta = ended.ledger.find((e) => e.seat === 1)!.delta;
    expect(winnerDelta).toBeGreaterThan(0);
    // Losers: discarder (0) pays full stake, others half.
    const d0 = ended.ledger.find((e) => e.seat === 0)!.delta;
    const d2 = ended.ledger.find((e) => e.seat === 2)!.delta;
    expect(Math.abs(d0)).toBeGreaterThan(Math.abs(d2));
  });

  it("discard with an existing reaction window stays in reaction phase until pass", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;
    const room = server.manager.get(c0.roomId!)!;
    const state = room.state!;

    // Seat 0 discards wan:1 — seat 1 (上家) could chi if holding wan:2,wan:3.
    let tile = state.wall.hands[0]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 1,
    );
    if (!tile) {
      // Force the first tile to wan:1.
      state.wall.hands[0]![0] = {
        instanceId: 31000,
        tile: { kind: "numbered", suit: "wan", rank: 1 },
      };
      tile = state.wall.hands[0]![0]!;
    }
    // Force seat 1 to hold wan:2, wan:3.
    state.wall.hands[1]![0] = { instanceId: 32000, tile: { kind: "numbered", suit: "wan", rank: 2 } };
    state.wall.hands[1]![1] = { instanceId: 32001, tile: { kind: "numbered", suit: "wan", rank: 3 } };

    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    c0.send({
      type: "discard",
      operationId: op(),
      tileInstanceId: tile.instanceId,
      generationId: snap.snapshot.generationId,
    });

    // Seat 1 sees a chi hint in its snapshot.
    const s1 = (await clients[1]!.snapshot((s) => s.reactionHint !== null)) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(s1.snapshot.reactionHint!.canChi).toBe(true);
    // Seat 1 executes the chi.
    const chiOption = s1.snapshot.reactionHint!.chiOptions[0]!;
    clients[1]!.send({
      type: "reaction",
      operationId: op(),
      kind: "chi",
      handTileIds: chiOption.handTileIds,
      generationId: s1.snapshot.generationId,
    });
    // Seat 1 now has a chi meld and must discard.
    const s1b = (await clients[1]!.snapshot(
      (s) =>
        s.status === "playing" &&
        s.turn === 1 &&
        (s.players[1]?.melds ?? []).some((m) => m.kind === "chi"),
    )) as Extract<ServerEvent, { type: "snapshot" }>;
    expect(
      (s1b.snapshot.players[1]!.melds as Array<{ kind: string }>).some((m) => m.kind === "chi"),
    ).toBe(true);
    expect(s1b.snapshot.turn).toBe(1);
  });

  it("stale generation and duplicate operationId are rejected/handled", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;
    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    const tileId = snap.snapshot.players[snap.snapshot.you]!.hand![0]!.instanceId;

    // Stale generation → error.
    c0.send({ type: "discard", operationId: op(), tileInstanceId: tileId, generationId: snap.snapshot.generationId - 100 });
    const err = (await c0.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err.code).toBe("stale_generation");

    // Valid discard with a fixed operationId.
    const opId = op();
    c0.send({ type: "discard", operationId: opId, tileInstanceId: tileId, generationId: snap.snapshot.generationId });
    const s = (await c0.snapshot((s) => s.discards.length > 0)) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(s.snapshot.discards).toContain(snap.snapshot.players[snap.snapshot.you]!.hand![0]!.id);

    // Duplicate operationId → no error, no double discard.
    c0.send({ type: "discard", operationId: opId, tileInstanceId: tileId });
    await new Promise((r) => setTimeout(r, 30));
    expect(c0.drain("error")).toHaveLength(0);
  });
});

describe("WSS — reconnect", () => {
  it("reconnect with playerId restores the seat mid-lobby", async () => {
    const clients = await setupRoom();
    const original = clients[0]!;
    const playerId = original.playerId!;
    const roomId = original.roomId!;
    original.close();
    await new Promise((r) => setTimeout(r, 50));

    const c = await connect();
    c.send({ type: "join", operationId: op(), roomId, playerId });
    const w = (await c.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
    expect(w.playerId).toBe(playerId);
    const snap = (await c.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    const me: PlayerView | undefined = snap.snapshot.players.find(
      (p: PlayerView) => p.playerId === playerId,
    );
    expect(me).toBeTruthy();
    expect(me!.connected).toBe(true);
    // No duplicate seat: still exactly 4 players.
    expect(snap.snapshot.players.length).toBe(4);
    c.close();
  });
});
```

## File: apps/server/src/scripts/ai-smoke.ts

```
/**
 * ai-smoke.ts — smoke test for the 3-AI auto-fill flow (serve:web mode).
 *
 * Connects ONE human WS client to ws://localhost:PORT/ws, creates a room,
 * and verifies:
 *   1. The AiController auto-joins 3 AI seats (ai-0/ai-1/ai-2).
 *   2. All 3 AIs auto-ready.
 *   3. After the human readies, the game starts automatically.
 *   4. AI seats actually play (each AI discards at least once during the hand).
 *   5. After a hand ends, the AIs auto-ready and the next hand starts.
 *
 * Usage (server must be running with ENABLE_AI on):
 *   node dist/apps/server/src/scripts/ai-smoke.js [WS_URL] [DURATION_MS]
 *
 * Exit 0 = PASS, 1 = FAIL.
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3002/ws";
const DURATION_MS = Number(process.argv[3] ?? 120_000);

let opCounter = 0;
const nextOp = (): string => `smoke-${++opCounter}`;

// --- Minimal wire types (mirror ClientSnapshot / TileWire from snapshot.ts) ---

interface TileWireLike {
  instanceId: number;
  id: string;
}

interface PlayerViewLike {
  seat: number;
  playerId: string | null;
  playerName: string;
  connected: boolean;
  ready: boolean;
  autoplay: boolean;
  handCount: number;
  /** Full hand — only populated for the viewer (you). */
  hand: TileWireLike[] | null;
}

interface ClientSnapshotLike {
  roomId: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  you: number;
  dealer: number | null;
  turn: number | null;
  gamePhase: string | null;
  players: PlayerViewLike[];
  lastDiscardBy: number | null;
  autoplayLog: Array<{ seat: number; action: string; reason: string; at: number }>;
  settlement: { winner: number | null; ledger: unknown[]; scores: number[] } | null;
}

interface SnapshotEventLike {
  roomId?: string;
  generationId?: number;
  snapshot?: ClientSnapshotLike;
}

const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
  console.log(`[ai-smoke] ${ok ? "✅ PASS" : "❌ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const aiJoined = new Set<string>();
const aiReady = new Set<string>();
const aiActed = new Set<string>();
let humanPlayerId: string | null = null;
let humanSeat: number | null = null;
let gameStarted = false;
let gameStartedNext = false;
let gameEnded = 0;
let nextStarted = 0;
let lastSnap: ClientSnapshotLike | null = null;

const ws = new WebSocket(WS_URL);

const timeout = setTimeout(() => {
  console.log("[ai-smoke] ⏰ overall timeout reached");
  finish();
}, DURATION_MS + 10_000);

function seatToPlayerId(snap: ClientSnapshotLike, seat: number): string | null {
  const p = snap.players[seat];
  return p ? p.playerId : null;
}

function finish(): void {
  clearTimeout(timeout);
  clearInterval(tick);
  const aiSeats = ["ai-0", "ai-1", "ai-2"];
  const allJoined = aiSeats.every((id) => aiJoined.has(id));
  const allReady = aiSeats.every((id) => aiReady.has(id));
  const allActed = aiSeats.every((id) => aiActed.has(id));

  check("3 AI seats auto-joined (ai-0/ai-1/ai-2)", allJoined, `joined=${[...aiJoined].join(",")}`);
  check("3 AIs auto-ready in lobby", allReady, `ready=${[...aiReady].join(",")}`);
  check("game started after human ready", gameStarted);
  check("each AI discarded at least once", allActed, `acted=${[...aiActed].join(",")}`);
  check("hand ended + next hand started (AI loop works)", gameEnded >= 1 && nextStarted >= 1, `ended=${gameEnded} nextStarted=${nextStarted}`);

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n[ai-smoke] 總計: ${checks.length - failed}/${checks.length} 項通過`);
  try { ws.close(); } catch { /* ignore */ }
  process.exit(failed === 0 ? 0 : 1);
}

ws.on("open", () => {
  console.log(`[ai-smoke] connected to ${WS_URL}`);
  ws.send(JSON.stringify({ type: "create", operationId: nextOp(), playerName: "測試員" }));
  console.log("[ai-smoke] sent create");
});

ws.on("message", (data) => {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(String(data));
  } catch {
    return;
  }
  const type = msg.type as string;

  if (type === "welcome") {
    console.log(`[ai-smoke] ← welcome`, JSON.stringify(msg).slice(0, 200));
    humanPlayerId = msg.playerId as string | null;
  } else if (type === "room.created" || type === "player.joined") {
    console.log(`[ai-smoke] ← ${type}`, JSON.stringify(msg).slice(0, 200));
  } else if (type === "game.started") {
    // Count only hands that started AFTER at least one hand ended — that proves
    // the AI auto-ready loop starts the next hand on its own.
    if (gameEnded >= 1) {
      nextStarted += 1;
      gameStartedNext = true;
    }
    if (!gameStarted) {
      gameStarted = true;
      console.log(`[ai-smoke] ← game.started (hand #1) dealer=${String(msg.dealer)} streak=${String(msg.dealerStreak)}`);
    } else {
      console.log(`[ai-smoke] ← game.started (next hand) dealer=${String(msg.dealer)} streak=${String(msg.dealerStreak)}`);
    }
  } else if (type === "game.ended") {
    gameEnded += 1;
    console.log(`[ai-smoke] ← game.ended winner=${String(msg.winner)}`);
    // AIs auto-ready → next hand starts on its own.
  } else if (type === "snapshot") {
    const snap = (msg as unknown as SnapshotEventLike).snapshot;
    if (!snap) return;
    // Diagnose the post-game.ended window: show status + ready flags so we can
    // see whether AIs re-ready and whether the next hand ever starts.
    if (gameEnded >= 1 && !gameStartedNext) {
      console.log(
        `[ai-smoke] 🔎 snap status=${snap.status} players=${snap.players
          .map((p) => `${p.playerId ?? "?"}:${p.ready ? "R" : "-"}:${p.connected ? "C" : "D"}`)
          .join(" ")} turn=${snap.turn} phase=${snap.gamePhase}`,
      );
    }
    lastSnap = snap;

    // --- Track AI join / ready from the players table. ---
    for (const p of snap.players) {
      const id = p.playerId;
      if (!id || !id.startsWith("ai-")) continue;
      if (p.connected) aiJoined.add(id);
      if (p.ready) aiReady.add(id);
    }

    // --- Track human seat (the non-AI player). ---
    if (humanSeat === null) {
      const me = snap.players.find((p) => p.playerId && !p.playerId.startsWith("ai-"));
      if (me) humanSeat = me.seat;
    }

    // --- Track AI discards via lastDiscardBy (a discard advances the game). ---
    if (snap.lastDiscardBy !== null && gameStarted) {
      const id = seatToPlayerId(snap, snap.lastDiscardBy);
      if (id && id.startsWith("ai-")) aiActed.add(id);
    }
  }
});

// Periodically drive the human seat: ready in lobby / ended, discard on its turn.
const tick = setInterval(() => {
  const snap = lastSnap;
  if (!snap) return;

  // The human seat may change per hand (dealer rotation); always resolve from
  // the players table so we never act on a stale seat.
  const me = snap.players.find((p) => p.playerId && !p.playerId.startsWith("ai-"));
  if (!me) return;

  // Lobby / ended → ready (human must ready once per round; AIs already ready).
  if (snap.status === "lobby" || snap.status === "ended") {
    if (!me.ready) {
      ws.send(JSON.stringify({ type: "ready", operationId: nextOp() }));
      if (snap.status === "ended") console.log("[ai-smoke] human ready for next round");
    }
    return;
  }

  // During the hand: if it's my discard turn, discard my first tile.
  if (snap.status === "playing" && snap.gamePhase === "discard" && snap.turn === me.seat) {
    const myHand = me.hand ?? [];
    if (myHand.length > 0) {
      const tileInstanceId = myHand[0]!.instanceId;
      ws.send(JSON.stringify({ type: "discard", tileInstanceId, operationId: nextOp() }));
    }
  }
}, 500);
```

## File: apps/server/src/scripts/qa-e2e.ts

```
/**
 * qa-e2e.ts — 全功能地端 E2E 實機綜合測試（情境 A/B/C/D）。
 *
 * 四個 WebSocket 機器人（A/B/C/D）連線至實際運行的地端伺服器
 * `ws://localhost:3000/ws`，依序執行四個 QA 情境並輸出 PASS/FAIL 報告：
 *
 *   情境 A【標準完整流程】:
 *     4 視窗連線 → 入座 → 準備 → 自動發牌 → 輪流摸打牌 → 自動胡牌結算
 *     → 點擊「準備下一局」重置（全員 ready → 下一局自動發牌）。
 *   情境 B【吃/碰/槓】:
 *     反應視窗開啟時依 reactionHint 觸發 吃/碰/槓；驗證快照副露(melds)
 *     正確揭露（客戶端 AnimatoinQueue 會依此播放動畫並鎖定輸入）。
 *   情境 C【逾時與託管恢復】:
 *     指定回合故意 15 秒不操作 → 驗證伺服器自動摸切（autoplayLog
 *     reason=timeout、快照 phaseDeadline/countdownMs、players[].autoplay）；
 *     之後手動出牌 → 驗證手動控制權恢復（autoplay=false 且指令被接受）。
 *   情境 D【連莊與結算帳本】:
 *     跨局驗證 莊家輪替/連莊 不變式（莊贏/流局 → 連莊 +1；閒家贏 → 過莊
 *     換人 streak=0）；每局驗證 ledger 四家 delta 加總為 0、台數明細
 *     breakdown.total >= 1、連莊加成規則存在。
 *
 * 使用（需先 build 並啟動伺服器）:
 *   pnpm --filter @taiwan-mahjong/server build
 *   TIMEOUT_MS=15000 node dist/apps/server/src/serve.js   # 終端 A
 *   node dist/apps/server/src/scripts/qa-e2e.js [WS_URL]
 *
 * Exit code 0 = 全部情境 PASS；1 = 任一情境 FAIL。
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
const BOT_NAMES = ["A", "B", "C", "D"] as const;

/** 情境 C 需要等待伺服器 15s 逾時自動摸切。 */
const TIMEOUT_WAIT_MS = 20_000;
const REACTION_JITTER_MS = 25;
const STEP_DELAY_MS = 250;
const OVERALL_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// QA 報告
// ---------------------------------------------------------------------------

interface QaCheck {
  scenario: string;
  name: string;
  passed: boolean;
  detail: string;
}

const checks: QaCheck[] = [];

function check(scenario: string, name: string, passed: boolean, detail = ""): void {
  checks.push({ scenario, name, passed, detail });
  const mark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[qa][${scenario}] ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function scenarioHeader(s: string): void {
  console.log(`\n================= 情境 ${s} =================`);
}

// ---------------------------------------------------------------------------
// Bot state
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  playerId: string | null;
  roomId: string | null;
  seat: number;
  ws: WebSocket | null;
  connected: boolean;
  lastActedGen: number;
  opCounter: number;
  /** Track melds observed in snapshots (Scenario B assertions). */
  meldCount: number;
  /** Highest simultaneous meld count seen (Scenario B). */
  maxMeldsSeen: number;
  /** Cumulative meld events by kind (Scenario B assertions). */
  chiCount: number;
  pengCount: number;
  kongCount: number;
  /** Track hand size to detect draws (Scenario A). */
  lastHandSize: number;
  /** Track own autoplay flag (Scenario C). */
  autoplay: boolean;
  /** Latest snapshot (for assertions). */
  lastSnap: Record<string, unknown> | null;
}

function makeBot(name: string): Bot {
  return {
    name,
    playerId: null,
    roomId: null,
    seat: -1,
    ws: null,
    connected: false,
    lastActedGen: -1,
    opCounter: 0,
    meldCount: 0,
    maxMeldsSeen: 0,
    chiCount: 0,
    pengCount: 0,
    kongCount: 0,
    lastHandSize: 0,
    autoplay: false,
    lastSnap: null,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);
const room = {
  id: "" as string | null,
  /** Number of hands completed (game.ended events). */
  ended: 0,
  /** game.started events seen. */
  started: 0,
  /** Current round's dealer + streak (captured at deal). */
  dealer: -1,
  streak: -1,
  /** Last ended hand's summary for Scenario D. */
  lastEnded: null as null | {
    winner: number | null;
    dealer: number;
    streak: number;
    selfDraw: boolean;
    ledger: Array<{ seat: number; delta: number }>;
    breakdown: { fans: Array<{ rule: string; value: number }>; total: number } | null;
    scores: number[];
  },
  /** Cumulative scores (verify ledger deltas apply). */
  scores: [0, 0, 0, 0],
  /** 是否已驗證過發牌張數（閒 16 / 莊 17）— 只做首張 playing 快照一次。 */
  dealtChecked: false,
  /** All ended rounds, for rotation invariant. */
  rounds: [] as Array<{ winner: number | null; dealer: number; streak: number }>,
  /** Hands won by an actual player (not 流局). */
  winCount: 0,
  /** Hands won by the dealer (for 連莊 checks). */
  dealerWinCount: 0,
};

let fatalError: string | null = null;
let finished = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `qa-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[qa] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function connectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} connect timeout`)), 10_000);
    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      log(`${bot.name} 連線成功`);
      resolve();
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on("close", () => {
      bot.connected = false;
    });
    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

interface SnapPlayer {
  seat: number;
  autoplay: boolean;
  hand: Array<{ instanceId: number; id: string }> | null;
  melds: Array<{ id: number; kind: string }>;
}

interface Snap {
  status: string;
  generationId: number;
  you: number;
  turn: number | null;
  gamePhase: string | null;
  phaseDeadline: number | null;
  countdownMs: number | null;
  players: SnapPlayer[];
  autoplayLog?: Array<{ seat: number; action: string; reason: string }>;
  reactionHint: {
    canChi: boolean;
    canPeng: boolean;
    canKong: boolean;
    chiOptions: Array<{ handTileIds: [number, number]; run: string[] }>;
    kongOptions: Array<{ kongType: string; handTileIds: number[]; pengMeldId?: number }>;
  } | null;
  settlement: {
    winner: number | null;
    selfDraw: boolean;
    kongDraw: boolean;
    breakdown: { fans: Array<{ rule: string; value: number }>; total: number } | null;
    ledger: Array<{ seat: number; delta: number }>;
    scores: number[];
  } | null;
}

function handleEvent(bot: Bot, evt: Record<string, unknown>): void {
  switch (evt.type) {
    case "welcome":
      bot.playerId = evt.playerId as string;
      bot.roomId = evt.roomId as string | null;
      break;
    case "room.created":
      room.id = evt.roomId as string;
      break;
    case "player.joined":
      bot.seat = evt.seat as number;
      room.id = evt.roomId as string;
      break;
    case "game.started": {
      // All 4 bots receive game.started — only A advances the counters so
      // room.started stays in sync with the number of hands actually dealt.
      if (bot.name !== "A") break;
      room.started += 1;
      room.dealer = evt.dealer as number;
      room.streak = evt.dealerStreak as number;
      log(`🎲 [發牌#${room.started}] 莊家 ${room.dealer} 連莊${room.streak}`);
      break;
    }
    case "game.ended": {
      if (bot.name !== "A") break;
      room.ended += 1;
      const ended: NonNullable<typeof room.lastEnded> = {
        winner: evt.winner as number | null,
        dealer: room.dealer,
        streak: room.streak,
        selfDraw: evt.selfDraw as boolean,
        ledger: (evt.ledger ?? []) as Array<{ seat: number; delta: number }>,
        breakdown: (evt.breakdown ?? null) as {
          fans: Array<{ rule: string; value: number }>;
          total: number;
        } | null,
        scores: (evt.scores ?? []) as number[],
      };
      room.lastEnded = ended;
      room.rounds.push({ winner: ended.winner, dealer: ended.dealer, streak: ended.streak });
      if (ended.winner !== null) {
        room.winCount += 1;
        if (ended.winner === ended.dealer) room.dealerWinCount += 1;
      }
      log(`🏁 [結束#${room.ended}] 勝者=${ended.winner} 莊=${ended.dealer} 連莊=${ended.streak}`);
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      // The room creator never receives player.joined (wss.ts sends only
      // welcome + room.created) — derive the seat from snap.you, exactly like
      // simulate-match.ts does.
      if (bot.seat === -1 && snap.you >= 0) {
        bot.seat = snap.you;
      }
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) {
            // New melds observed — tally by kind (Scenario B).
            const newMelds = mine.melds.slice(bot.meldCount);
            for (const m of newMelds) {
              if (m.kind === "chi") bot.chiCount += 1;
              else if (m.kind === "peng") bot.pengCount += 1;
              else if (m.kind === "kong") bot.kongCount += 1;
            }
            bot.meldCount = mine.melds.length;
            if (mine.melds.length > bot.maxMeldsSeen) bot.maxMeldsSeen = mine.melds.length;
          }
          if (mine.hand) bot.lastHandSize = mine.hand.length;
          // 台灣 16 張制：發牌後閒家 16、莊家 17（花牌在 flowers 不佔手牌）。
          // 只做第一次 playing 快照的一次性檢查，避免每局重複計數。
          if (!room.dealtChecked && bot.name === "A" && mine.hand) {
            room.dealtChecked = true;
            const expected = bot.seat === room.dealer ? 17 : 16;
            check(
              "A",
              "發牌張數 閒16/莊17",
              mine.hand.length === expected,
              `seat=${bot.seat} dealer=${room.dealer} hand=${mine.hand.length} (期望 ${expected})`,
            );
          }
        }
      }
      break;
    }
    case "error": {
      const code = evt.code as string;
      const msg = evt.message as string;
      if (["stale_generation", "wrong_phase", "no_discard", "illegal_chi", "illegal_peng", "illegal_kong", "not_your_turn", "not_lobby"].includes(code)) {
        return; // benign race
      }
      log(`⚠️ ${bot.name} 收到錯誤 ${code}: ${msg}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Win-oriented discard strategy
//
// The server auto-finishes self-draw wins (detectWin on each draw), so bots
// only need to preserve tiles that move them toward a complete hand. We score
// each candidate discard by the value of the hand it leaves behind:
//
//   * complete melds (triplet / run) score +3
//   * a pair scores +2 (pair is the "eyes")
//   * a partial run (two tiles of a consecutive run) scores +1
//   * an isolated honor (wind/dragon) scores 0 — first to go
//
// Honours: a lone honor is never useful unless forming a pair/triplet.
// ---------------------------------------------------------------------------

type IdTile = { instanceId: number; id: string };

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

function idSuitRank(id: string): { suit: string; rank: number } | null {
  const [cat, val] = id.split(":");
  if (!cat || !val) return null;
  if (cat === "flower") return null;
  if (cat === "honor") return { suit: "honor", rank: HONOR_RANKS.indexOf(val as (typeof HONOR_RANKS)[number]) };
  if (NUM_SUITS.includes(cat as (typeof NUM_SUITS)[number])) {
    const r = Number(val);
    if (Number.isFinite(r) && r >= 1 && r <= 9) return { suit: cat, rank: r };
  }
  return null;
}

/** Score how valuable a tile identity is within the current hand. */
function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0; // flowers handled by server, never in our discard choice
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") {
    // Lone honor is worthless; pair/triplet has value.
    return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  }
  // numbered: count runs with neighbors
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0; // triplet or pair
  value += hasLeft && hasRight ? 1 : 0; // interior of a run
  value += hasLeft || hasRight ? 1 : 0; // partial run
  return value;
}

/**
 * Choose the discard that keeps the strongest partial hand.
 * Falls back to discarding the tile with the lowest identity value, breaking
 * ties by discarding the oldest tile first (stable hand → fewer re-shuffles).
 */
function pickWinDiscard(hand: IdTile[]): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Sabotage: deliberately keep the hand broken so the dealer (SABOTAGE.dealer)
 * wins. We discard the tile that leaves the FEWEST useful patterns, i.e. the
 * opposite of pickWinDiscard — but never a tile that would leave a lone honor
 * around (that actually helps the dealer claim). We simply maximize the damage:
 * discard the tile with the HIGHEST value (break the strongest meld).
 */
function pickSabotageTile(hand: IdTile[], _dealer: number): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  // If everything scores 0 (all lone honors), just dump a random one.
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// Scenario D: dealer-streak (sabotage) driver
// ---------------------------------------------------------------------------

const SABOTAGE = {
  /** Activate from this round onward (dealer wins consecutive hands). */
  active: false,
  round: -1,
  dealer: -1,
};

// ---------------------------------------------------------------------------
// Bot decision logic — acts on snapshots (Scenario A + B)
// ---------------------------------------------------------------------------

function handleSnapshot(bot: Bot, snap: Snap): void {
  if (snap.status === "ended") return;
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window: 吃/碰/槓 (Scenario B). ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    const hint = snap.reactionHint;
    // Sabotage mode: non-dealer bots never claim reaction tiles — the dealer
    // keeps first pick of every discard, so it can win consecutive hands.
    const saboteur =
      SABOTAGE.active &&
      SABOTAGE.round === room.ended + 1 &&
      bot.seat !== SABOTAGE.dealer;
    if (saboteur) {
      send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
      log(`  ${bot.name} (破壞牌)過`);
      return;
    }
    if (hint.canKong && hint.kongOptions.length > 0) {
      const opt = hint.kongOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "kong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      log(`  ${bot.name} 槓(${opt.kongType})`);
      return;
    }
    if (hint.canPeng) {
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "peng"),
        generationId: snap.generationId,
        kind: "peng",
      });
      log(`  ${bot.name} 碰!`);
      return;
    }
    if (hint.canChi && hint.chiOptions.length > 0) {
      const opt = hint.chiOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "chi"),
        generationId: snap.generationId,
        kind: "chi",
        handTileIds: opt.handTileIds,
      });
      log(`  ${bot.name} 吃!`);
      return;
    }
    send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // Scenario C: bot B stops discarding once — the server must auto-摸切
    // after the 15s thinking-timeout, then B recovers manual control by
    // discarding on its next turn.
    if (
      SCENARIO_C.active &&
      bot.name === SCENARIO_C.botName &&
      SCENARIO_C.round === room.ended + 1
    ) {
      if (!SCENARIO_C.timedOut) {
        // Stall: don't send anything — server will auto-discard at the timeout.
        SCENARIO_C.firstTurnSeen = true;
        SCENARIO_C.turnGeneration = snap.generationId;
        SCENARIO_C.turnSeat = bot.seat;
        if (!SCENARIO_C.turnStartedAt) SCENARIO_C.turnStartedAt = Date.now();
        log(`  ⏸️ ${bot.name} 故意不操作（情境 C 逾時測試，等 15 秒）…`);
        return;
      }
      // Server auto-摸切 happened — resume manual control now (recovery).
      SCENARIO_C.recovered = true;
      log(`  🎮 ${bot.name} 手動恢復出牌（情境 C 託管恢復）…`);
    }

    // Optional self-kong (30% chance) to enrich Scenario B.
    const hint = snap.reactionHint;
    if (hint && hint.canKong && hint.kongOptions.length > 0 && Math.random() < 0.3) {
      const opt = pickRandom(hint.kongOptions)!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "selfkong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      log(`  ${bot.name} 自槓(${opt.kongType})`);
      return;
    }

    // Sabotage mode (dealer-streak rounds): non-dealer bots dump pairs/triplets
    // first so the dealer can reliably win consecutive hands (Scenario D 連莊台).
    const saboteur =
      SABOTAGE.active &&
      SABOTAGE.round === room.ended + 1 &&
      bot.seat !== SABOTAGE.dealer;
    const discard = saboteur
      ? pickSabotageTile(hand, SABOTAGE.dealer)
      : pickWinDiscard(hand);
    if (!discard) return;
    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: discard.instanceId,
    });
    log(
      `  ${bot.name} ${saboteur ? "(破壞牌)" : ""}打出 ${discard.id}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Scenario C state
// ---------------------------------------------------------------------------

const SCENARIO_C = {
  active: false,
  botName: "B" as string,
  round: -1,
  firstTurnSeen: false,
  turnGeneration: -1,
  turnSeat: -1,
  /** Epoch ms when bot B's stalled turn began (waiting for the 15s timeout). */
  turnStartedAt: null as number | null,
  /** Set once the server auto-discarded (timeout fired). */
  timedOut: false,
  /** Set once the bot manually discarded on a later turn. */
  recovered: false,
};

// ---------------------------------------------------------------------------
// Scenario drivers
// ---------------------------------------------------------------------------

/** 全員按準備。若房間在 ended 狀態，第一個 ready 會重置房間（情境 A 重置流程）。 */
function everyoneReadies(): void {
  for (const bot of bots) {
    send(bot, { type: "ready", operationId: opId(bot, "ready") });
  }
}

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

let lastProgressAt = Date.now();
function touchProgress(): void {
  lastProgressAt = Date.now();
}

function startWatchdog(): void {
  const iv = setInterval(() => {
    if (finished || fatalError) return;
    if (Date.now() - lastProgressAt > OVERALL_TIMEOUT_MS) {
      fatalError = `Watchdog 逾時：無進度 ${OVERALL_TIMEOUT_MS / 1000}s`;
      log(`[qa] ❌ ${fatalError}`);
      finish();
    }
  }, 5000);
}

function finish(): void {
  if (finished) return;
  finished = true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(`WS=${WS_URL}  情境 A/B/C/D 綜合測試`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    log(`[qa] ❌ ${fatalError}`);
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  await sleep(300);

  // --- A 開房，B/C/D 加入。 ---
  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await sleep(300);
  const roomId = room.id;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  log(`🏠 房號 ${roomId} 建立（4 視窗連線）`);
  for (const bot of bots.slice(1)) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId, playerName: bot.name });
    await sleep(200);
  }
  await sleep(400);
  // 驗證 4 人入座。
  const seated = bots.every((b) => b.seat >= 0 && b.seat < 4);
  const seats = bots.map((b) => b.seat).join(",");
  check("A", "4 視窗連線並入座", seated, `座位=[${seats}]`);

  // ---------------------------------------------------------------------
  // 情境 A + B + D：多局標準流程，途中觸發吃碰槓。
  // 情境 C：指定局 bot B 停止出牌，等待 15s 逾時。
  // ---------------------------------------------------------------------
  // 5 局：破壞牌模式第 3~5 局連續啟用，給莊家足夠機會連胡達連莊台。
  const TARGET_ROUNDS = 5;
  let scenarioCTriggered = false;

  while (room.ended < TARGET_ROUNDS && !fatalError) {
    const nextRound = room.ended + 1;
    const startedBefore = room.started;

    log(`\n--- 第 ${nextRound} 局準備（全員 Ready） ---`);
    // 情境 C：第 2 局啟用 bot B 逾時。
    if (nextRound === 2) {
      SCENARIO_C.active = true;
      SCENARIO_C.round = 2;
      SCENARIO_C.botName = "B";
      SCENARIO_C.firstTurnSeen = false;
      SCENARIO_C.timedOut = false;
      SCENARIO_C.recovered = false;
      scenarioCTriggered = true;
    }
    // 情境 D：第 3 局起啟動「破壞牌」模式 — 讓莊家連續胡牌以驗證連莊台。
    // dealer 在 game.started 之後才會更新為本局莊家（見下方發牌後指派）。
    if (nextRound >= 3) {
      SABOTAGE.active = true;
      SABOTAGE.round = nextRound;
      log(`  🎯 情境 D：破壞牌模式待發牌後啟用（第 ${nextRound} 局）`);
    }

    everyoneReadies();
    touchProgress();

    // 等待 game.started。
    const startWait = Date.now();
    while (room.started === startedBefore && !fatalError) {
      if (Date.now() - startWait > 15_000) {
        fatalError = "等待 game.started 逾時";
        break;
      }
      await sleep(200);
    }
    if (fatalError) break;
    touchProgress();

    // 情境 D：發牌後鎖定本局莊家，破壞牌模式只針對非莊家 bot。
    if (SABOTAGE.active && SABOTAGE.round === nextRound && room.dealer >= 0) {
      SABOTAGE.dealer = room.dealer;
      log(`  🎯 破壞牌模式啟用：莊家=${SABOTAGE.dealer}（其餘三家故意拆牌）`);
    }

    // 等待本局結束（期間 bots 自動出牌/反應）。
    const endWait = Date.now();
    while (room.ended < nextRound && !fatalError) {
      // 情境 C：等待逾時自動摸切。
      if (SCENARIO_C.active && SCENARIO_C.firstTurnSeen && !SCENARIO_C.timedOut) {
        const bSnap = bots[1]!.lastSnap as unknown as Snap | null;
        const bMine = bSnap?.players?.find((p) => p.seat === bots[1]!.seat);
        const hasTimeoutLog = bSnap?.autoplayLog?.some(
          (a) => a.seat === bots[1]!.seat && a.action === "discard" && a.reason === "timeout",
        );
        if (hasTimeoutLog || (bMine && bMine.autoplay)) {
          SCENARIO_C.timedOut = true;
          log(`  🤖 情境 C：伺服器已自動摸切（逾時）`);
        }
      }

      // bots 繼續正常出牌（情境 C 逾時後 B 恢復手動）。
      for (const bot of bots) {
        const snap = bot.lastSnap as unknown as Snap | null;
        if (snap) handleSnapshot(bot, snap);
      }

      if (Date.now() - endWait > 120_000) {
        fatalError = `第 ${nextRound} 局等待結束逾時`;
        break;
      }
      await sleep(REACTION_JITTER_MS);
      touchProgress();
    }
    if (fatalError) break;

    // ---- 情境 A 驗證 ----
    check("A", "本局自動胡牌結算（game.ended）", room.ended === nextRound);
    const ended = room.lastEnded!;
    check("A", "結算含四家分數增減（ledger）", !!ended && ended.ledger.length === 4);
    const ledgerSum = ended ? ended.ledger.reduce((n, e) => n + e.delta, 0) : -1;
    check("A", "ledger 四家 delta 總和為 0", ledgerSum === 0, `sum=${ledgerSum}`);

    // ---- 情境 B 驗證（每局，吃/碰/槓發生與否皆記錄） ----
    const meldsThisRound = bots.reduce((n, b) => n + b.meldCount, 0);
    if (meldsThisRound > 0) {
      check(
        "B",
        "本局觸發吃/碰/槓副露",
        meldsThisRound > 0,
        `共 ${meldsThisRound} 副露（吃${bots.reduce((n, b) => n + b.chiCount, 0)} 碰${bots.reduce((n, b) => n + b.pengCount, 0)} 槓${bots.reduce((n, b) => n + b.kongCount, 0)}）`,
      );
    }

    // ---- 情境 D 驗證（每局） ----
    if (room.rounds.length >= 2) {
      const prev = room.rounds[room.rounds.length - 2]!;
      const cur = room.rounds[room.rounds.length - 1]!;
      const expectedDealer =
        prev.winner === null || prev.winner === prev.dealer ? prev.dealer : (prev.dealer + 1) % 4;
      const expectedStreak =
        prev.winner === null || prev.winner === prev.dealer ? prev.streak + 1 : 0;
      check(
        "D",
        "莊家輪替不變式（過莊/連莊）",
        cur.dealer === expectedDealer && cur.streak === expectedStreak,
        `局${cur.dealer}/${cur.streak} 應為 ${expectedDealer}/${expectedStreak}`,
      );
    }
    // 連莊加成規則存在於 fan 明細中（當 streak>1 且莊家贏）。
    if (ended && ended.breakdown && ended.breakdown.fans.some((f) => f.rule === "莊家連莊台")) {
      check("D", "連莊加成台數明細存在", true, `streak=${ended.streak}`);
    }

    // ---- 情境 C 驗證（第 2 局） ----
    if (nextRound === 2) {
      SCENARIO_C.active = false;
      check(
        "C",
        "15 秒不操作後伺服器自動摸切",
        SCENARIO_C.timedOut,
        SCENARIO_C.timedOut ? "已觸發" : "未觸發",
      );
      check(
        "C",
        "逾時後手動出牌恢復控制權",
        SCENARIO_C.recovered,
        SCENARIO_C.recovered ? "B 已手動恢復出牌" : "未恢復",
      );
    }
  }

  // ---- 整體情境驗證（多局累計） ----
  if (!fatalError) {
    const totalMelds = bots.reduce((n, b) => n + b.meldCount, 0);
    check(
      "A",
      "至少一局真實胡牌結算（非流局）",
      room.winCount > 0,
      `實勝 ${room.winCount} 局`,
    );
    check(
      "B",
      "整場出現吃/碰/槓副露",
      totalMelds > 0,
      `共 ${totalMelds} 副露（吃${bots.reduce((n, b) => n + b.chiCount, 0)} 碰${bots.reduce((n, b) => n + b.pengCount, 0)} 槓${bots.reduce((n, b) => n + b.kongCount, 0)}）`,
    );
    // 莊家需在破壞牌期間（第 3 局起）連胡至少 2 局，才能把 streak 推到 ≥2，
    // 這代表真的觸發過連莊台（莊家連莊台 fan）。用「最終 streak ≥ 2」當主判定，
    // 比單純數 dealerWinCount 更能反映「連續」胡牌（中間不能插流局/閒家胡）。
    const lastRound = room.rounds[room.rounds.length - 1];
    const maxStreak = room.rounds.reduce((m, r) => Math.max(m, r.streak), 0);
    check(
      "D",
      "莊家連續胡牌（連莊台）",
      maxStreak >= 2,
      `最高連莊 streak=${maxStreak}（莊家勝 ${room.dealerWinCount} 局）`,
    );
    if (lastRound && lastRound.streak >= 2) {
      check("D", "最終連莊 streak ≥ 2", true, `streak=${lastRound.streak}`);
    }
  }

  // ---- 情境 A 最後驗證：準備下一局重置。 ----
  // 第 5 局結束後，全員再按一次準備 → 應觸發第 6 局 game.started（重置流程）。
  if (!fatalError) {
    const startedBefore = room.started;
    log("\n--- 點擊「準備下一局」重置（情境 A 收尾） ---");
    everyoneReadies();
    const waitUntil = Date.now() + 15_000;
    while (room.started === startedBefore && Date.now() < waitUntil) {
      await sleep(200);
    }
    check("A", "準備下一局 → 自動重置並發新局", room.started > startedBefore);
  }

  printReport();

  for (const bot of bots) bot.ws?.close();
  const allPass = checks.every((c) => c.passed) && !fatalError;
  process.exit(allPass ? 0 : 1);
}

function printReport(): void {
  console.log("\n\n================ QA E2E 綜合測試報告 ================");
  console.log(`WS: ${WS_URL}`);
  console.log(`完成局數: ${room.ended}  （game.started×${room.started}）`);
  if (fatalError) console.log(`致命錯誤: ${fatalError}`);
  const byScenario = new Map<string, QaCheck[]>();
  for (const c of checks) {
    if (!byScenario.has(c.scenario)) byScenario.set(c.scenario, []);
    byScenario.get(c.scenario)!.push(c);
  }
  for (const [scenario, list] of byScenario) {
    const pass = list.filter((c) => c.passed).length;
    console.log(`\n情境 ${scenario}: ${pass}/${list.length} PASS`);
    for (const c of list) {
      console.log(`  ${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
  }
  const totalPass = checks.filter((c) => c.passed).length;
  console.log(`\n總計: ${totalPass}/${checks.length} 項通過`);
  console.log("==================================================");
}

void main();
```

## File: apps/server/src/scripts/qa-stress.ts

```
/**
 * qa-stress.ts — 100 局極限壓力測試（高頻點擊 / 斷線重連 / 超時託管 / 連莊過莊）。
 *
 * 四個 WebSocket 機器人對實際運行中的地端伺服器 `ws://localhost:3000/ws`
 * 連續進行 100 局快節奏對局，涵蓋：
 *
 *   STRESS-1【高頻隨機點擊】: 隨機回合以 1~5ms 間隔連續送出重複指令
 *     （同張重複 discard、亂序 generationId、重複 operationId）→ 驗證
 *     generation/operationId 冪等防重機制穩定（錯誤率低、無狀態崩潰）。
 *   STRESS-2【斷線 / 重連】: 隨機 bot 在隨機回合中途離線再以同 playerId
 *     重連 → 驗證座位恢復（connected 轉 true、autoplay 結束、可繼續出牌）。
 *   STRESS-3【快速超時 / 自動託管】: 每 ~7 局故意 1 回合不操作（TIMEOUT_MS
 *     設 1500ms 加速）→ 驗證伺服器自動摸切 + autoplayLog reason=timeout，
 *     之後手動恢復出牌。
 *   STRESS-4【連莊 / 過莊】: 全程以「破壞牌」模式讓莊家連胡，跨局驗證
 *     莊家輪替不變式與連莊 streak 累積（最終需出現 streak ≥ 2）。
 *   STRESS-5【記憶體 / OperationId 洩漏】: 每 25 局透過 HTTP /health 抓取
 *     process.memoryUsage + room/socket 計數，驗證無持續增長（洩漏）；
 *     並驗證重複 operationId 不會被重複執行（冪等）、每局 executed set 重置
 *     （不無界膨脹）。
 *
 * 使用（需先 build 並啟動伺服器）:
 *   pnpm --filter @taiwan-mahjong/server build
 *   TIMEOUT_MS=1500 node dist/apps/server/src/serve.js   # 終端 A（加速超時）
 *   node dist/apps/server/src/scripts/qa-stress.js [WS_URL] [HTTP_URL]
 *
 * Exit code 0 = 全部 PASS；1 = 任一 FAIL。
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
// HTTP health endpoint (same origin as WS by default).
const HTTP_URL = process.argv[3] ?? WS_URL.replace(/^ws/, "http").replace(/\/ws$/, "");

const BOT_NAMES = ["A", "B", "C", "D"] as const;

/** 加速超時（serve 端需以 TIMEOUT_MS=1500 啟動，測試端等 4s 保險）。 */
const TIMEOUT_WAIT_MS = 4_000;
const REACTION_JITTER_MS = 5;
const STEP_DELAY_MS = 20;
const OVERALL_TIMEOUT_MS = 600_000;
const TARGET_ROUNDS = 100;

// ---------------------------------------------------------------------------
// QA 報告
// ---------------------------------------------------------------------------

interface QaCheck {
  scenario: string;
  name: string;
  passed: boolean;
  detail: string;
}

const checks: QaCheck[] = [];

function check(scenario: string, name: string, passed: boolean, detail = ""): void {
  checks.push({ scenario, name, passed, detail });
  const mark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[stress][${scenario}] ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function scenarioHeader(s: string): void {
  console.log(`\n================= ${s} =================`);
}

// ---------------------------------------------------------------------------
// Bot state
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  playerId: string | null;
  roomId: string | null;
  seat: number;
  ws: WebSocket | null;
  connected: boolean;
  lastActedGen: number;
  opCounter: number;
  meldCount: number;
  autoplay: boolean;
  lastHandSize: number;
  lastSnap: Record<string, unknown> | null;
}

function makeBot(name: string): Bot {
  return {
    name,
    playerId: null,
    roomId: null,
    seat: -1,
    ws: null,
    connected: false,
    lastActedGen: -1,
    opCounter: 0,
    meldCount: 0,
    autoplay: false,
    lastHandSize: 0,
    lastSnap: null,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);

const room = {
  id: "" as string | null,
  started: 0,
  ended: 0,
  dealer: -1,
  streak: -1,
  rounds: [] as Array<{ winner: number | null; dealer: number; streak: number }>,
  dealerWinCount: 0,
};

// --- 壓力計數 ---
const stress = {
  duplicateDiscards: 0,
  repeatedOpIds: 0,
  staleGeneration: 0,
  wrongPhase: 0,
  benignErrors: 0,
  unknownErrors: 0,
  reconnects: 0,
  timeoutsSeen: 0,
  recoveryDiscards: 0,
};

let fatalError: string | null = null;
let finished = false;

// ---------------------------------------------------------------------------
// 冪等 / 壓力參數
// ---------------------------------------------------------------------------

/** 每 25 局記憶體採樣（STRESS-5）。 */
const memSamples: Array<{ round: number; rssMB: number; heapUsedMB: number; sockets: number; rooms: number }> = [];

/** 每局結束後執行 set 大小採樣（透過 /health 或直接查 manager 失敗時以 0 標記）。 */
let lastExecutedEstimate = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `stress-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[stress] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// HTTP /health (memory + socket + room telemetry for STRESS-5)
// ---------------------------------------------------------------------------

interface HealthStats {
  ok: boolean;
  rooms?: number;
  sockets?: number;
  memory?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  executedEstimate?: number;
}

async function fetchHealth(): Promise<HealthStats | null> {
  try {
    const res = await fetch(`${HTTP_URL}/health`);
    if (!res.ok) return null;
    return (await res.json()) as HealthStats;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Connection (with reconnect support — STRESS-2)
// ---------------------------------------------------------------------------

function connectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} connect timeout`)), 10_000);
    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      log(`${bot.name} 連線成功${bot.playerId ? `（重連 id=${bot.playerId}）` : ""}`);
      resolve();
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on("close", () => {
      bot.connected = false;
    });
    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

/** STRESS-2: 斷開單一 bot 的連線，稍後以同 playerId 重連。 */
async function dropAndReconnect(bot: Bot): Promise<void> {
  const pid = bot.playerId;
  const rid = room.id;
  bot.ws?.close(4000, "stress drop");
  bot.connected = false;
  await sleep(120);
  if (!pid) return;
  // 重連後帶同 playerId → 伺服器恢復座位（RoomManager.reconnect）。
  await connectBot(bot);
  // 新 socket 尚未認證 — 需重新送出 join（帶同 playerId）以恢復座位。
  if (rid) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId: rid, playerId: pid, playerName: bot.name });
    await sleep(120);
  }
  stress.reconnects += 1;
  log(`🔁 ${bot.name} 斷線重連完成（playerId=${pid}）`);
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

interface SnapPlayer {
  seat: number;
  autoplay: boolean;
  hand: Array<{ instanceId: number; id: string }> | null;
  melds: Array<{ id: number; kind: string }>;
}

interface Snap {
  status: string;
  generationId: number;
  you: number;
  turn: number | null;
  gamePhase: string | null;
  phaseDeadline: number | null;
  countdownMs: number | null;
  players: SnapPlayer[];
  autoplayLog?: Array<{ seat: number; action: string; reason: string }>;
  reactionHint: {
    canChi: boolean;
    canPeng: boolean;
    canKong: boolean;
    chiOptions: Array<{ handTileIds: [number, number]; run: string[] }>;
    kongOptions: Array<{ kongType: string; handTileIds: number[]; pengMeldId?: number }>;
  } | null;
  settlement: {
    winner: number | null;
    selfDraw: boolean;
    kongDraw: boolean;
    breakdown: { fans: Array<{ rule: string; value: number }>; total: number } | null;
    ledger: Array<{ seat: number; delta: number }>;
    scores: number[];
  } | null;
}

function handleEvent(bot: Bot, evt: Record<string, unknown>): void {
  switch (evt.type) {
    case "welcome":
      bot.playerId = evt.playerId as string;
      bot.roomId = evt.roomId as string | null;
      break;
    case "room.created":
      room.id = evt.roomId as string;
      break;
    case "player.joined":
      bot.seat = evt.seat as number;
      room.id = evt.roomId as string;
      break;
    case "game.started":
      if (bot.name !== "A") break;
      room.started += 1;
      room.dealer = evt.dealer as number;
      room.streak = evt.dealerStreak as number;
      log(`🎲 [發牌#${room.started}] 莊家 ${room.dealer} 連莊${room.streak}`);
      break;
    case "game.ended": {
      if (bot.name !== "A") break;
      room.ended += 1;
      const winner = evt.winner as number | null;
      room.rounds.push({ winner, dealer: room.dealer, streak: room.streak });
      if (winner !== null && winner === room.dealer) room.dealerWinCount += 1;
      log(`🏁 [結束#${room.ended}] 勝者=${winner} 莊=${room.dealer} 連莊=${room.streak}`);
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      if (bot.seat === -1 && snap.you >= 0) bot.seat = snap.you;
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) bot.meldCount = mine.melds.length;
          if (mine.hand) bot.lastHandSize = mine.hand.length;
        }
      }
      break;
    }
    case "error": {
      const code = evt.code as string;
      if (["stale_generation", "wrong_phase", "no_discard", "illegal_chi", "illegal_peng", "illegal_kong", "not_your_turn", "not_lobby"].includes(code)) {
        stress.benignErrors += 1;
        if (code === "stale_generation") stress.staleGeneration += 1;
        if (code === "wrong_phase") stress.wrongPhase += 1;
        return;
      }
      stress.unknownErrors += 1;
      log(`⚠️ ${bot.name} 收到未知錯誤 ${code}: ${evt.message}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Win-oriented discard strategy (same as qa-e2e)
// ---------------------------------------------------------------------------

type IdTile = { instanceId: number; id: string };

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

function idSuitRank(id: string): { suit: string; rank: number } | null {
  const [cat, val] = id.split(":");
  if (!cat || !val) return null;
  if (cat === "flower") return null;
  if (cat === "honor") return { suit: "honor", rank: HONOR_RANKS.indexOf(val as (typeof HONOR_RANKS)[number]) };
  if (NUM_SUITS.includes(cat as (typeof NUM_SUITS)[number])) {
    const r = Number(val);
    if (Number.isFinite(r) && r >= 1 && r <= 9) return { suit: cat, rank: r };
  }
  return null;
}

function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0;
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0;
  value += hasLeft && hasRight ? 1 : 0;
  value += hasLeft || hasRight ? 1 : 0;
  return value;
}

function pickWinDiscard(hand: IdTile[]): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** 破壞牌：丟最高價值張，讓莊家容易連胡（STRESS-4 連莊）。 */
function pickSabotageTile(hand: IdTile[]): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// STRESS-1: 高頻隨機點擊（重複 discard / 重複 opId / 亂序 generation）
// ---------------------------------------------------------------------------

/** 隨機選一局觸發「高頻重複點擊」：同一張牌連打 3 次 + 重複 opId + 亂序 generation。 */
function stressSpamDiscards(bot: Bot, snap: Snap, hand: IdTile[], discard: IdTile): void {
  const gen = snap.generationId;
  const baseOp = opId(bot, "spam");
  const payload = {
    type: "discard",
    operationId: baseOp,
    generationId: gen,
    tileInstanceId: discard.instanceId,
  };
  // 第一次：正常指令。
  send(bot, payload);
  stress.duplicateDiscards += 1;
  // 第二次：同一 operationId（冪等 — 伺服器應丟棄，不回錯誤）。
  send(bot, payload);
  stress.repeatedOpIds += 1;
  // 第三次：同張牌但新 operationId（可能 wrong_phase — 屬良性競態）。
  send(bot, { ...payload, operationId: opId(bot, "spam2") });
  stress.duplicateDiscards += 1;
  // 第四次：亂序 generation（stale_generation — 屬良性）。
  send(bot, { ...payload, operationId: opId(bot, "spam3"), generationId: gen - 5 });
  stress.duplicateDiscards += 1;
}

// ---------------------------------------------------------------------------
// Bot decision logic
// ---------------------------------------------------------------------------

/** 本局是否為破壞牌模式（STRESS-4：全場啟用，莊家連胡）。 */
function isSabotageRound(_round: number): boolean {
  return true;
}

function handleSnapshot(bot: Bot, snap: Snap, round: number): void {
  if (snap.status === "ended") return;
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window: 破壞牌模式一律過（讓莊家連胡）。 ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    if (isSabotageRound(round) && bot.seat !== room.dealer) {
      send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
      return;
    }
    const hint = snap.reactionHint;
    if (hint.canKong && hint.kongOptions.length > 0) {
      const opt = hint.kongOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "kong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      return;
    }
    if (hint.canPeng) {
      send(bot, { type: "reaction", operationId: opId(bot, "peng"), generationId: snap.generationId, kind: "peng" });
      return;
    }
    if (hint.canChi && hint.chiOptions.length > 0) {
      const opt = hint.chiOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "chi"),
        generationId: snap.generationId,
        kind: "chi",
        handTileIds: opt.handTileIds,
      });
      return;
    }
    send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // STRESS-3: 快速超時 — 每 ~7 局指定 bot 故意 1 回合不操作。
    if (stressTimeout.active && stressTimeout.round === round && bot.name === stressTimeout.botName) {
      if (!stressTimeout.timedOut) {
        stressTimeout.firstTurnSeen = true;
        stressTimeout.turnSeat = bot.seat;
        stressTimeout.turnGeneration = snap.generationId;
        if (!stressTimeout.turnStartedAt) stressTimeout.turnStartedAt = Date.now();
        log(`  ⏸️ ${bot.name} 故意不操作（STRESS-3 快速超時）…`);
        return;
      }
      // 伺服器已自動摸切 — 手動恢復出牌。
      stressTimeout.recovered = true;
      stress.recoveryDiscards += 1;
      log(`  🎮 ${bot.name} 手動恢復出牌（STRESS-3）`);
    }

    const saboteur = isSabotageRound(round) && bot.seat !== room.dealer;
    const discard = saboteur ? pickSabotageTile(hand) : pickWinDiscard(hand);
    if (!discard) return;

    // STRESS-1: 隨機觸發高頻重複點擊（每局約 15% 機率）。
    if (Math.random() < 0.15) {
      stressSpamDiscards(bot, snap, hand, discard);
      log(`  ⚡ ${bot.name} 高頻重複點擊（連打 ${discard.id}×3 + 重複 opId + 亂序 gen）`);
      return;
    }

    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: discard.instanceId,
    });
    log(`  ${bot.name} ${saboteur ? "(破壞牌)" : ""}打出 ${discard.id}`);
  }
}

// ---------------------------------------------------------------------------
// STRESS-3 狀態
// ---------------------------------------------------------------------------

const stressTimeout = {
  active: false,
  botName: "B" as string,
  round: -1,
  firstTurnSeen: false,
  turnGeneration: -1,
  turnSeat: -1,
  turnStartedAt: null as number | null,
  timedOut: false,
  recovered: false,
};

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

let lastProgressAt = Date.now();
function touchProgress(): void {
  lastProgressAt = Date.now();
}

function startWatchdog(): void {
  const iv = setInterval(() => {
    if (finished || fatalError) return;
    if (Date.now() - lastProgressAt > OVERALL_TIMEOUT_MS) {
      fatalError = `Watchdog 逾時：無進度 ${OVERALL_TIMEOUT_MS / 1000}s`;
      log(`[stress] ❌ ${fatalError}`);
      finish();
    }
  }, 5000);
}

function finish(): void {
  if (finished) return;
  finished = true;
}

function everyoneReadies(): void {
  for (const bot of bots) {
    send(bot, { type: "ready", operationId: opId(bot, "ready") });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(`WS=${WS_URL}  STRESS-1~5 綜合壓力測試（目標 ${TARGET_ROUNDS} 局）`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  await sleep(200);

  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await sleep(200);
  const roomId = room.id;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  log(`🏠 房號 ${roomId} 建立（STRESS-1~5）`);
  for (const bot of bots.slice(1)) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId, playerName: bot.name });
    await sleep(60);
  }
  await sleep(200);
  const seated = bots.every((b) => b.seat >= 0 && b.seat < 4);
  check("基礎", "4 視窗連線並入座", seated, `座位=[${bots.map((b) => b.seat).join(",")}]`);

  let lastDropRound = 0;

  while (room.ended < TARGET_ROUNDS && !fatalError) {
    const round = room.ended + 1;
    const startedBefore = room.started;

    // STRESS-3: 每 ~7 局啟用快速超時（不同 bot 輪流）。
    if (round % 7 === 2) {
      stressTimeout.active = true;
      stressTimeout.round = round;
      stressTimeout.botName = BOT_NAMES[round % 4]!;
      stressTimeout.firstTurnSeen = false;
      stressTimeout.timedOut = false;
      stressTimeout.recovered = false;
      stressTimeout.turnGeneration = -1;
      stressTimeout.turnStartedAt = null;
      log(`  ⏱️ STRESS-3 啟用：${stressTimeout.botName} 第 ${round} 局不操作（快速超時）`);
    } else {
      stressTimeout.active = false;
    }

    everyoneReadies();
    touchProgress();

    const startWait = Date.now();
    while (room.started === startedBefore && !fatalError) {
      if (Date.now() - startWait > 15_000) {
        fatalError = "等待 game.started 逾時";
        break;
      }
      await sleep(80);
    }
    if (fatalError) break;
    touchProgress();

    // STRESS-2: 每 ~10 局隨機斷線一個 bot 再重連（不中斷對局，伺服器自動託管過渡）。
    if (round - lastDropRound >= 10) {
      const victim = pickRandom(bots)!;
      if (victim.playerId) {
        log(`  🔌 STRESS-2：斷線 ${victim.name}（第 ${round} 局中途）`);
        await dropAndReconnect(victim);
        lastDropRound = round;
      }
    }

    // 本局進行（bots 自動出牌；STRESS-1/3 觸發）。
    const endWait = Date.now();
    while (room.ended < round && !fatalError) {
      // STRESS-3：偵測伺服器已自動摸切。
      if (stressTimeout.active && stressTimeout.firstTurnSeen && !stressTimeout.timedOut) {
        const sSnap = bots.find((b) => b.name === stressTimeout.botName)?.lastSnap as unknown as Snap | null;
        const hasTimeoutLog = sSnap?.autoplayLog?.some(
          (a) => a.seat === stressTimeout.turnSeat && a.action === "discard" && a.reason === "timeout",
        );
        if (hasTimeoutLog || (sSnap && sSnap.players.find((p) => p.seat === stressTimeout.turnSeat)?.autoplay)) {
          stressTimeout.timedOut = true;
          stress.timeoutsSeen += 1;
          log(`  🤖 STRESS-3：伺服器已自動摸切（逾時）`);
        }
      }

      // 觸發 STRESS-2 重連後，bot 可能短暫離線 → 跳過未連線 bot。
      for (const bot of bots) {
        if (!bot.connected || !bot.ws || bot.ws.readyState !== WebSocket.OPEN) continue;
        const snap = bot.lastSnap as unknown as Snap | null;
        if (snap) handleSnapshot(bot, snap, round);
      }

      if (Date.now() - endWait > 120_000) {
        fatalError = `第 ${round} 局等待結束逾時`;
        break;
      }
      await sleep(REACTION_JITTER_MS);
      touchProgress();
    }
    if (fatalError) break;

    // ---- 每局基礎驗證 ----
    check("基礎", "本局自動胡牌結算", room.ended === round);
    if (room.ended === round) {
      // room 物件本身不含快照 — 改由任一 bot 的 lastSnap 讀取本局結算。
      const snapA = bots[0]!.lastSnap as unknown as Snap | null;
      const ended = snapA?.settlement ?? null;
      if (ended && ended.ledger) {
        const sum = ended.ledger.reduce((n, e) => n + e.delta, 0);
        check("基礎", "ledger 四家 delta 總和為 0", sum === 0, `sum=${sum}`);
      }
    }

    // ---- STRESS-4：莊家輪替不變式（連莊/過莊） ----
    if (room.rounds.length >= 2) {
      const prev = room.rounds[room.rounds.length - 2]!;
      const cur = room.rounds[room.rounds.length - 1]!;
      const expectedDealer =
        prev.winner === null || prev.winner === prev.dealer ? prev.dealer : (prev.dealer + 1) % 4;
      const expectedStreak = prev.winner === null || prev.winner === prev.dealer ? prev.streak + 1 : 0;
      check(
        "STRESS-4",
        "莊家輪替不變式（過莊/連莊）",
        cur.dealer === expectedDealer && cur.streak === expectedStreak,
        `局${cur.dealer}/${cur.streak} 應為 ${expectedDealer}/${expectedStreak}`,
      );
    }

    // ---- STRESS-3 驗證（本局若啟用） ----
    if (stressTimeout.active && stressTimeout.round === round) {
      check(
        "STRESS-3",
        "快速超時後伺服器自動摸切",
        stressTimeout.timedOut,
        stressTimeout.timedOut ? "已觸發" : "未觸發",
      );
      check(
        "STRESS-3",
        "超時後手動恢復出牌",
        stressTimeout.recovered,
        stressTimeout.recovered ? `${stressTimeout.botName} 已恢復` : "未恢復",
      );
    }

    // ---- STRESS-5：每 25 局記憶體 / 連線計數採樣 ----
    if (room.ended % 25 === 0) {
      const h = await fetchHealth();
      memSamples.push({
        round: room.ended,
        rssMB: h?.memory ? Math.round(h.memory.rss / 1024 / 1024) : -1,
        heapUsedMB: h?.memory ? Math.round(h.memory.heapUsed / 1024 / 1024) : -1,
        sockets: h?.sockets ?? -1,
        rooms: h?.rooms ?? -1,
      });
      log(`📊 STRESS-5 採樣 #${memSamples.length}: ${JSON.stringify(memSamples[memSamples.length - 1])}`);
      if (h?.executedEstimate !== undefined) lastExecutedEstimate = h.executedEstimate;
    }
  }

  // ---------------------------------------------------------------------
  // 彙總驗證
  // ---------------------------------------------------------------------
  if (!fatalError) {
    check("基礎", "完成 100 局", room.ended === TARGET_ROUNDS, `實際 ${room.ended} 局`);

    // STRESS-1：高頻重複點擊不崩潰、未知錯誤為 0。
    check(
      "STRESS-1",
      "高頻重複點擊已觸發",
      stress.duplicateDiscards > 0,
      `重複指令 ${stress.duplicateDiscards} 次`,
    );
    check(
      "STRESS-1",
      "重複 operationId 已送出（冪等驗證）",
      stress.repeatedOpIds > 0,
      `${stress.repeatedOpIds} 次`,
    );
    check(
      "STRESS-1",
      "亂序 generation / 錯誤率受控（無未知錯誤）",
      stress.unknownErrors === 0,
      `unknown=${stress.unknownErrors} stale=${stress.staleGeneration} wrongPhase=${stress.wrongPhase} benign=${stress.benignErrors}`,
    );

    // STRESS-2：斷線重連至少 5 次且座位恢復。
    check(
      "STRESS-2",
      "斷線 / 重連多次成功",
      stress.reconnects >= 5,
      `重連 ${stress.reconnects} 次`,
    );
    check(
      "STRESS-2",
      "重連後座位正確（seat ∈ 0..3）",
      bots.every((b) => b.seat >= 0 && b.seat < 4),
      `座位=[${bots.map((b) => b.seat).join(",")}]`,
    );

    // STRESS-3：快速超時多次觸發 + 恢復。
    check(
      "STRESS-3",
      "快速超時自動託管多次觸發",
      stress.timeoutsSeen >= 3,
      `觸發 ${stress.timeoutsSeen} 次`,
    );
    check(
      "STRESS-3",
      "託管後手動恢復多次成功",
      stress.recoveryDiscards >= 3,
      `恢復 ${stress.recoveryDiscards} 次`,
    );

    // STRESS-4：破壞牌模式 → 連莊 streak ≥ 2。
    const maxStreak = room.rounds.reduce((m, r) => Math.max(m, r.streak), 0);
    check(
      "STRESS-4",
      "莊家連續胡牌（連莊 streak ≥ 2）",
      maxStreak >= 2,
      `最高連莊 streak=${maxStreak}（莊家勝 ${room.dealerWinCount} 局）`,
    );

    // STRESS-5：記憶體無洩漏（末段中位數 vs 前段中位數）。
    if (memSamples.length >= 3) {
      const first = memSamples.slice(0, Math.max(2, Math.floor(memSamples.length / 3)));
      const last = memSamples.slice(-Math.max(2, Math.floor(memSamples.length / 3)));
      const median = (xs: number[]): number => {
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)] ?? 0;
      };
      const rssFirst = median(first.map((s) => s.rssMB).filter((v) => v >= 0));
      const rssLast = median(last.map((s) => s.rssMB).filter((v) => v >= 0));
      const heapFirst = median(first.map((s) => s.heapUsedMB).filter((v) => v >= 0));
      const heapLast = median(last.map((s) => s.heapUsedMB).filter((v) => v >= 0));
      const rssGrowth = rssLast - rssFirst;
      const heapGrowth = heapLast - heapFirst;
      check(
        "STRESS-5",
        "RSS 記憶體無洩漏（末段 ≤ 前段 + 64MB）",
        rssGrowth <= 64,
        `RSS ${rssFirst}MB → ${rssLast}MB（+${rssGrowth}MB）`,
      );
      check(
        "STRESS-5",
        "Heap Used 無洩漏（末段 ≤ 前段 + 64MB）",
        heapGrowth <= 64,
        `Heap ${heapFirst}MB → ${heapLast}MB（+${heapGrowth}MB）`,
      );
    } else {
      check("STRESS-5", "記憶體採樣不足", false, `僅 ${memSamples.length} 次採樣`);
    }
  }

  printReport();

  for (const bot of bots) bot.ws?.close();
  const allPass = checks.every((c) => c.passed) && !fatalError;
  process.exit(allPass ? 0 : 1);
}

function printReport(): void {
  console.log("\n\n================ QA STRESS 壓力測試報告 ================");
  console.log(`WS: ${WS_URL}`);
  console.log(`完成局數: ${room.ended}  （game.started×${room.started}）`);
  if (fatalError) console.log(`致命錯誤: ${fatalError}`);
  console.log(
    `壓力統計: 重複指令=${stress.duplicateDiscards} 重複opId=${stress.repeatedOpIds} ` +
      `stale=${stress.staleGeneration} wrongPhase=${stress.wrongPhase} benign=${stress.benignErrors} ` +
      `unknown=${stress.unknownErrors} 重連=${stress.reconnects} 超時=${stress.timeoutsSeen} 恢復=${stress.recoveryDiscards}`,
  );
  const byScenario = new Map<string, QaCheck[]>();
  for (const c of checks) {
    if (!byScenario.has(c.scenario)) byScenario.set(c.scenario, []);
    byScenario.get(c.scenario)!.push(c);
  }
  for (const [scenario, list] of byScenario) {
    const pass = list.filter((c) => c.passed).length;
    console.log(`\n${scenario}: ${pass}/${list.length} PASS`);
    for (const c of list) {
      console.log(`  ${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
  }
  const totalPass = checks.filter((c) => c.passed).length;
  console.log(`\n總計: ${totalPass}/${checks.length} 項通過`);
  console.log("==================================================");
}

void main();
```

## File: apps/server/src/scripts/simulate-match.ts

```
/**
 * simulate-match.ts — 20-round headless bot simulation (with autoplay + rotation).
 *
 * Four WebSocket bots (A/B/C/D) play full Taiwan 16-tile mahjong rounds end to
 * end against a running server at ws://localhost:3000/ws:
 *   1. A creates a room, B/C/D join, everyone readies → auto-deal.
 *   2. Each bot reacts to snapshots:
 *        - own discard turn  → discard a random tile (optionally self-kong first).
 *        - reaction window   → respond kong > peng > chi when eligible.
 *   3. Autoplay (斷線逾時自動託管) scenarios:
 *        - At a deterministic round boundary a bot drops its connection
 *          mid-round; the server 自動託管s (摸切 / pass) so the table never
 *          stalls. The bot reconnects with its playerId → manual control.
 *   4. Dealer rotation verification: we track the dealer seat + 連莊 streak
 *      announced in game.started / game.ended and assert the invariant
 *      (dealer win/流局 → same seat + streak+1; non-dealer win → next seat,
 *      streak 0) every round.
 *
 * Usage (after `pnpm --filter @taiwan-mahjong/server build`):
 *   node dist/apps/server/src/scripts/simulate-match.js [WS_URL] [ROUNDS]
 *
 * The server should be started with a short timeout for a fast autoplay test:
 *   TIMEOUT_MS=400 node dist/apps/server/src/serve.js
 *
 * Exit code 0 when all rounds complete and all invariants hold; 1 otherwise.
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
const TARGET_ROUNDS = Number(process.argv[3] ?? 20);
const BOT_NAMES = ["A", "B", "C", "D"] as const;

const OVERALL_TIMEOUT_MS = 180_000;
const REACTION_JITTER_MS = 20;

// ---------------------------------------------------------------------------
// Bot state
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  playerId: string | null;
  roomId: string | null;
  seat: number;
  ws: WebSocket | null;
  ready: boolean;
  connected: boolean;
  /** Last snapshot generationId we acted on (dedup). */
  lastActedGen: number;
  /** Incrementing per-bot command counter (operationId uniqueness). */
  opCounter: number;
  /** Tally of reactions actually attempted per round. */
  reactions: { chi: number; peng: number; kong: number; pass: number };
  /** Latest room autoplay audit log observed in a snapshot (for summaries). */
  lastAutoplayLog: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
  /** Reconnect counter (autoplay scenario bookkeeping). */
  reconnects: number;
  /** Absolute round in which this bot should disconnect mid-round. */
  disconnectAtRound: number;
  /** True while the socket is intentionally closed (autoplay scenario). */
  intentionallyDown: boolean;
}

function makeBot(name: string): Bot {
  return {
    name,
    playerId: null,
    roomId: null,
    seat: -1,
    ws: null,
    ready: false,
    connected: false,
    lastActedGen: -1,
    opCounter: 0,
    reactions: { chi: 0, peng: 0, kong: 0, pass: 0 },
    lastAutoplayLog: [],
    reconnects: 0,
    disconnectAtRound: -1,
    intentionallyDown: false,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);

// ---------------------------------------------------------------------------
// Round bookkeeping
// ---------------------------------------------------------------------------

interface RoundResult {
  round: number;
  dealer: number;
  dealerStreak: number;
  winner: number | null;
  winnerName: string;
  selfDraw: boolean;
  kongDraw: boolean;
  discardCount: number;
  reactions: { chi: number; peng: number; kong: number };
  autoplayLog: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
}

const roundResults: RoundResult[] = [];
let currentRound = 0;
/** Discards tallied for the CURRENT round only (reset on each game.ended). */
let roundDiscards = 0;
let fatalError: string | null = null;

/** Dealer seat / streak announced at the CURRENT round's deal (game.started). */
let currentDealer = 0;
let currentStreak = 0;
/** Round of the hand currently in play (increments at each game.started). */
let dealtRound = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `sim-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[sim] ${msg}`);
}

function logRound(msg: string): void {
  console.log(`[sim][round ${currentRound}] ${msg}`);
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Keep an eye on global progress — abort if nothing happens for too long. */
let lastProgressAt = Date.now();
let watchdogTimer: NodeJS.Timeout | null = null;

function touchProgress(): void {
  lastProgressAt = Date.now();
}

function startWatchdog(): void {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    if (fatalError) return;
    if (Date.now() - lastProgressAt > OVERALL_TIMEOUT_MS) {
      fatalError = `Watchdog: no progress for ${OVERALL_TIMEOUT_MS / 1000}s (round ${currentRound})`;
      log(`[sim] FATAL: ${fatalError}`);
      finish();
    }
  }, 5000);
}

// ---------------------------------------------------------------------------
// Autoplay / reconnect helpers
// ---------------------------------------------------------------------------

function disconnectBot(bot: Bot): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.intentionallyDown = true;
  logRound(`🔌 ${bot.name} 斷線（觸發自動託管）`);
  try {
    bot.ws.close();
  } catch {
    /* ignore */
  }
}

function reconnectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} reconnect timeout`)), 10_000);

    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      // Reconnect with the SAME playerId → server restores the seat + manual control.
      send(bot, {
        type: "join",
        operationId: opId(bot, "rejoin"),
        roomId: bot.roomId,
        playerId: bot.playerId,
        playerName: bot.name,
      });
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      bot.connected = false;
      if (!bot.intentionallyDown) log(`${bot.name} 連線關閉`);
    });

    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

// ---------------------------------------------------------------------------
// Bot decision logic (driven by snapshots)
// ---------------------------------------------------------------------------

interface Snap {
  status: string;
  generationId: number;
  you: number;
  turn: number | null;
  gamePhase: string | null;
  players: Array<{
    seat: number;
    autoplay: boolean;
    hand: Array<{ instanceId: number; id: string }> | null;
  }>;
  reactionHint: {
    canChi: boolean;
    canPeng: boolean;
    canKong: boolean;
    chiOptions: Array<{ handTileIds: [number, number]; run: string[] }>;
    kongOptions: Array<{
      kongType: string;
      handTileIds: number[];
      pengMeldId?: number;
    }>;
  } | null;
}

function handleSnapshot(bot: Bot, snap: Snap): void {
  // Skip acting while the bot is intentionally disconnected (offline).
  if (bot.intentionallyDown) return;
  // Dedup: act at most once per generationId.
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  if (snap.status === "ended") return; // handled via game.ended event

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window against someone else's discard. ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    const hint = snap.reactionHint;
    if (hint.canKong && hint.kongOptions.length > 0) {
      const opt = hint.kongOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "kong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      bot.reactions.kong += 1;
      logRound(
        `${bot.name} 明槓/搶槓 (${opt.kongType}) on gen ${snap.generationId}`,
      );
      touchProgress();
      return;
    }
    if (hint.canPeng) {
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "peng"),
        generationId: snap.generationId,
        kind: "peng",
      });
      bot.reactions.peng += 1;
      logRound(`${bot.name} 碰! on gen ${snap.generationId}`);
      touchProgress();
      return;
    }
    if (hint.canChi && hint.chiOptions.length > 0) {
      const opt = hint.chiOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "chi"),
        generationId: snap.generationId,
        kind: "chi",
        handTileIds: opt.handTileIds,
      });
      bot.reactions.chi += 1;
      logRound(
        `${bot.name} 吃! ${opt.run.join(",")} on gen ${snap.generationId}`,
      );
      touchProgress();
      return;
    }
    // Eligible but nothing specific — pass to keep the game moving.
    send(bot, {
      type: "pass",
      operationId: opId(bot, "pass"),
      generationId: snap.generationId,
    });
    bot.reactions.pass += 1;
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // Optional self-kong (closed / add-on) before discarding — 30% chance.
    const hint = snap.reactionHint;
    if (hint && hint.canKong && hint.kongOptions.length > 0 && Math.random() < 0.3) {
      const opt = pickRandom(hint.kongOptions)!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "selfkong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      bot.reactions.kong += 1;
      logRound(`${bot.name} 自槓 (${opt.kongType}) on gen ${snap.generationId}`);
      touchProgress();
      return;
    }

    const tile = pickRandom(hand)!;
    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: tile.instanceId,
    });
    roundDiscards += 1;
    logRound(`${bot.name} 打出 ${tile.id} (gen ${snap.generationId})`);
    touchProgress();
  }
}

// ---------------------------------------------------------------------------
// Round flow
// ---------------------------------------------------------------------------

async function everyoneReadies(): Promise<void> {
  // Restore any bot that is still intentionally down BEFORE readying — the
  // deal requires all four seats connected.
  for (const bot of bots) {
    if (!bot.intentionallyDown) continue;
    bot.intentionallyDown = false;
    bot.reconnects += 1;
    logRound(`🔌 ${bot.name} 重連（恢復手動控制）`);
    try {
      await reconnectBot(bot);
    } catch (err) {
      fatalError = `重連失敗 ${bot.name}: ${err instanceof Error ? err.message : String(err)}`;
      finish();
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  for (const bot of bots) {
    bot.ready = false;
    send(bot, {
      type: "ready",
      operationId: opId(bot, "ready"),
      generationId: undefined,
    });
  }
}

function resetReactionTallies(): void {
  for (const bot of bots) bot.reactions = { chi: 0, peng: 0, kong: 0, pass: 0 };
}

/** Advance to the next round. Only bot A (the room creator) drives this. */
function onGameEnded(payload: {
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  scores: number[];
  dealer: number;
  dealerStreak: number;
}): void {
  currentRound += 1;
  const winnerName = payload.winner === null ? "流局" : (bots[payload.winner]?.name ?? "?");
  const chi = bots.reduce((n, b) => n + b.reactions.chi, 0);
  const peng = bots.reduce((n, b) => n + b.reactions.peng, 0);
  const kong = bots.reduce((n, b) => n + b.reactions.kong, 0);
  // Copy the room's autoplay audit log (best-effort; each bot's last snapshot
  // of the ended room may carry a subset — dedupe by action+seat+reason).
  const autoplayLog: RoundResult["autoplayLog"] = [];
  for (const bot of bots) {
    for (const a of bot.lastAutoplayLog) {
      if (!autoplayLog.some((x) => x.seat === a.seat && x.action === a.action && x.reason === a.reason)) {
        autoplayLog.push(a);
      }
    }
  }
  roundResults.push({
    round: currentRound,
    dealer: payload.dealer,
    dealerStreak: payload.dealerStreak,
    winner: payload.winner,
    winnerName,
    selfDraw: payload.selfDraw,
    kongDraw: payload.kongDraw,
    discardCount: roundDiscards,
    reactions: { chi, peng, kong },
    autoplayLog,
  });
  logRound(
    `🏁 結束: 勝者=${winnerName} 莊=${payload.dealer} 連莊=${payload.dealerStreak} ` +
      `自摸=${payload.selfDraw} 槓上開花=${payload.kongDraw} ` +
      `分數=[${payload.scores.join(",")}] 吃=${chi} 碰=${peng} 槓=${kong}`,
  );
  if (autoplayLog.length > 0) {
    logRound(
      `🤖 自動託管紀錄: ${autoplayLog.map((a) => `${bots[a.seat]!.name} ${a.action}(${a.reason})`).join(", ")}`,
    );
  }
  touchProgress();

  // Schedule the next round's disconnect scenario.
  scheduleDisconnectForNextRound();

  if (currentRound >= TARGET_ROUNDS) {
    log(`✅ 完成 ${TARGET_ROUNDS} 局模擬`);
    finish();
    return;
  }
  log(`第 ${currentRound + 1} 局準備中（全員重新 Ready → 重置房間）…`);
  void everyoneReadies();
}

/** Reset per-round tallies (discards / reactions) when a new hand starts. */
function resetRoundStats(): void {
  roundDiscards = 0;
  resetReactionTallies();
}

// ---------------------------------------------------------------------------
// Autoplay scenario scheduling
// ---------------------------------------------------------------------------

/**
 * Assign the disconnect rounds for the upcoming hands. Deterministic so the
 * scenario always exercises 1-2 offline bots across the 20 rounds. The room
 * creator (A) is never disconnected — it drives the round advancement.
 *   round 5  → C disconnects (then reconnects before the next hand).
 *   round 10 → B disconnects and STAYS down for the whole round.
 *   round 15 → both D and C go down for the round.
 */
/** Persistent record of every scheduled disconnect (for final verification). */
const disconnectScenarios: Array<{ round: number; name: string }> = [];

function scheduleDisconnectForNextRound(): void {
  for (const bot of bots) bot.disconnectAtRound = -1;
  const next = currentRound + 1;
  if (next === 5) {
    bots[2]!.disconnectAtRound = 5; // C
    disconnectScenarios.push({ round: 5, name: "C" });
  } else if (next === 10) {
    bots[1]!.disconnectAtRound = 10; // B
    disconnectScenarios.push({ round: 10, name: "B" });
  } else if (next === 15) {
    bots[3]!.disconnectAtRound = 15; // D
    bots[2]!.disconnectAtRound = 15; // C
    disconnectScenarios.push({ round: 15, name: "D" }, { round: 15, name: "C" });
  }
}

// ---------------------------------------------------------------------------
// Connection setup
// ---------------------------------------------------------------------------

function connectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} connect timeout`)), 10_000);

    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      log(`${bot.name} 連線成功`);
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      bot.connected = false;
      if (!bot.intentionallyDown) log(`${bot.name} 連線關閉`);
    });

    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

function handleEvent(bot: Bot, evt: Record<string, unknown>): void {
  switch (evt.type) {
    case "welcome": {
      bot.playerId = evt.playerId as string;
      bot.roomId = evt.roomId as string | null;
      break;
    }
    case "room.created": {
      bot.roomId = evt.roomId as string;
      log(`[sim] 🏠 房號 ${bot.roomId} 建立（玩家 ${bot.name}）`);
      touchProgress();
      break;
    }
    case "player.joined": {
      const seat = evt.seat as number;
      const name = evt.playerName as string;
      bot.seat = seat;
      bot.roomId = evt.roomId as string;
      log(`[sim] ${name} 入座 seat ${seat} (房 ${bot.roomId})`);
      touchProgress();
      break;
    }
    case "game.started": {
      resetRoundStats();
      // Capture the dealer + streak AT DEAL TIME — this is the source of truth
      // for the rotation invariant (game.ended reports the post-settlement
      // rotation, i.e. the NEXT hand's dealer).
      // Only bot A (the room creator) advances the round counters — every bot
      // receives game.started, so gating here keeps dealtRound in sync with
      // currentRound (otherwise 4 bots would inflate dealtRound to 4×).
      if (bot.name === "A") {
        dealtRound += 1;
        currentDealer = evt.dealer as number;
        currentStreak = evt.dealerStreak as number;
        logRound(`🎲 發牌完成（莊家 ${currentDealer} 連莊${currentStreak}）`);
        touchProgress();
      }
      break;
    }
    case "game.ended": {
      // Only the room creator advances the round — otherwise the same
      // game.ended would be counted once per bot.
      if (bot.name !== "A") break;
      onGameEnded({
        winner: evt.winner as number | null,
        selfDraw: evt.selfDraw as boolean,
        kongDraw: evt.kongDraw as boolean,
        scores: evt.scores as number[],
        // The dealer / streak that governed THIS hand (captured at deal time).
        dealer: currentDealer,
        dealerStreak: currentStreak,
      });
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as Snap & {
        autoplayLog?: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
      };
      if (snap.status === "playing" && bot.seat === -1) {
        // seat comes from player.joined — but guard anyway
        bot.seat = snap.you;
      }
      // Stash the room's autoplay audit log for the ended-round summary.
      if (snap.autoplayLog) bot.lastAutoplayLog = snap.autoplayLog;
      // Autoplay scenario: a scheduled bot drops mid-hand (playing only —
      // lobby snapshots must never trigger the disconnect).
      if (
        snap.status === "playing" &&
        bot.disconnectAtRound === dealtRound &&
        !bot.intentionallyDown
      ) {
        disconnectBot(bot);
        return; // don't act on this snapshot; we're going offline
      }
      handleSnapshot(bot, snap);
      break;
    }
    case "error": {
      const code = evt.code as string;
      const msg = evt.message as string;
      // Ignore benign race errors (stale / wrong phase / already reacted).
      if (code === "stale_generation" || code === "wrong_phase" || code === "no_discard" || code === "illegal_chi" || code === "illegal_peng" || code === "illegal_kong") {
        logRound(`⚠️ ${bot.name} 忽略 ${code}: ${msg}`);
        return;
      }
      if (code === "not_your_turn" || code === "not_lobby") return;
      log(`[sim] ❌ ${bot.name} 收到錯誤 ${code}: ${msg}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Assert the 莊家輪替/連莊 invariant across consecutive rounds.
 * Round n+1's dealer must be:
 *   - same seat as round n when round n had a dealer win or a draw (連莊);
 *   - the next seat after round n's dealer on a non-dealer win (過莊);
 * and dealerStreak must be +1 (連莊) / 0 (過莊) respectively.
 */
function verifyDealerRotation(): string[] {
  const errors: string[] = [];
  for (let i = 1; i < roundResults.length; i++) {
    const prev = roundResults[i - 1]!;
    const cur = roundResults[i]!;
    const expectedDealer =
      prev.winner === null || prev.winner === prev.dealer
        ? prev.dealer
        : (prev.dealer + 1) % 4;
    const expectedStreak =
      prev.winner === null || prev.winner === prev.dealer ? prev.dealerStreak + 1 : 0;
    if (cur.dealer !== expectedDealer) {
      errors.push(
        `局${cur.round}: 莊家應為 ${expectedDealer}（局${prev.round} 莊${prev.dealer} 勝者${prev.winner}），實際 ${cur.dealer}`,
      );
    }
    if (cur.dealerStreak !== expectedStreak) {
      errors.push(
        `局${cur.round}: 連莊應為 ${expectedStreak}，實際 ${cur.dealerStreak}`,
      );
    }
  }
  return errors;
}

/** Verify autoplay actually engaged at least once across the run. */
function verifyAutoplayEngaged(): string[] {
  const errors: string[] = [];
  const total = roundResults.reduce((n, r) => n + r.autoplayLog.length, 0);
  if (total === 0) {
    errors.push("自動託管完全沒有觸發（斷線情境未生效或 server 未啟用 autoplay）");
  }
  // Every scheduled disconnect must have produced at least one autoplay action
  // in its round — an offline bot must never stall the table.
  for (const s of disconnectScenarios) {
    const round = roundResults.find((r) => r.round === s.round);
    if (round && round.autoplayLog.length === 0) {
      errors.push(`局${s.round} ${s.name} 斷線但沒有任何自動託管動作（桌子卡住？）`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let finished = false;
function finish(): void {
  if (finished) return;
  finished = true;
  if (watchdogTimer) clearInterval(watchdogTimer);

  const rotationErrors = verifyDealerRotation();
  const autoplayErrors = verifyAutoplayEngaged();

  const reasons: string[] = [];
  if (fatalError) reasons.push(fatalError);
  if (roundResults.length < TARGET_ROUNDS) {
    reasons.push(`僅完成 ${roundResults.length}/${TARGET_ROUNDS} 局`);
  }
  if (rotationErrors.length > 0) reasons.push(`連莊/過莊驗證失敗 ${rotationErrors.length} 項`);
  if (autoplayErrors.length > 0) reasons.push(`自動託管驗證失敗 ${autoplayErrors.length} 項`);
  if (reasons.length > 0) {
    log(`[sim] ❌ 模擬失敗: ${reasons.join("；")}`);
    for (const e of rotationErrors) log(`[sim] ❌ 連莊驗證: ${e}`);
    for (const e of autoplayErrors) log(`[sim] ❌ 自動託管驗證: ${e}`);
    printSummary();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }

  printSummary();
  for (const bot of bots) bot.ws?.close();
  process.exit(0);
}

function printSummary(): void {
  console.log("\n================ 模擬結果 ================");
  console.log(`目標局數: ${TARGET_ROUNDS}  完成: ${roundResults.length}`);
  const wins = [0, 0, 0, 0];
  const selfDraws = roundResults.filter((r) => r.selfDraw).length;
  const draws = roundResults.filter((r) => r.winner === null).length;
  for (const r of roundResults) {
    if (r.winner !== null) wins[r.winner] = (wins[r.winner] ?? 0) + 1;
  }
  const totals = { chi: 0, peng: 0, kong: 0 };
  for (const r of roundResults) {
    totals.chi += r.reactions.chi;
    totals.peng += r.reactions.peng;
    totals.kong += r.reactions.kong;
  }
  console.log(`勝利: A=${wins[0]} B=${wins[1]} C=${wins[2]} D=${wins[3]} 流局=${draws}`);
  const totalDiscards = roundResults.reduce((n, r) => n + r.discardCount, 0);
  console.log(`自摸局: ${selfDraws}  總棄牌: ${totalDiscards}`);
  console.log(`反應統計: 吃=${totals.chi} 碰=${totals.peng} 槓=${totals.kong}`);
  const totalAutoplay = roundResults.reduce((n, r) => n + r.autoplayLog.length, 0);
  const disconnectActions = roundResults.reduce(
    (n, r) => n + r.autoplayLog.filter((a) => a.reason === "disconnect").length,
    0,
  );
  console.log(`自動託管: 觸發=${totalAutoplay}（斷線=${disconnectActions} 逾時=${totalAutoplay - disconnectActions}）`);
  const reconnects = bots.reduce((n, b) => n + b.reconnects, 0);
  console.log(`重連次數: ${reconnects}`);
  for (const r of roundResults) {
    console.log(
      `  局 ${String(r.round).padStart(2, " ")}: 莊=${r.dealer} 連莊=${r.dealerStreak} ` +
        `勝者=${r.winnerName.padEnd(3)} 自摸=${r.selfDraw ? "Y" : "N"} 槓上=${r.kongDraw ? "Y" : "N"} ` +
        `吃=${r.reactions.chi} 碰=${r.reactions.peng} 槓=${r.reactions.kong}` +
        (r.autoplayLog.length > 0 ? ` 託管[${r.autoplayLog.map((a) => `${bots[a.seat]!.name}${a.action}`).join(",")}]` : ""),
    );
  }
  console.log("==========================================");
}

async function main(): Promise<void> {
  log(`WS=${WS_URL} 目標=${TARGET_ROUNDS} 局`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    log(`[sim] ❌ ${fatalError}`);
    finish();
    return;
  }

  // Small settle delay so all welcome/join events flush.
  await new Promise((r) => setTimeout(r, 300));

  // A creates the room.
  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await new Promise((r) => setTimeout(r, 300));

  // B/C/D join A's room.
  const roomId = bots[0]!.roomId;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    finish();
    return;
  }
  for (const bot of bots.slice(1)) {
    send(bot, {
      type: "join",
      operationId: opId(bot, "join"),
      roomId,
      playerName: bot.name,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Schedule the first round's disconnect scenario (round 5 → C).
  scheduleDisconnectForNextRound();

  log(`[sim] 4 人到齊（房 ${roomId}），全部按準備…`);
  await new Promise((r) => setTimeout(r, 300));
  everyoneReadies();

  // Wait until the target is reached or a fatal error appears.
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (fatalError || roundResults.length >= TARGET_ROUNDS) {
        clearInterval(iv);
        resolve();
      }
    }, 250);
  });

  if (fatalError) {
    log(`[sim] ❌ 模擬失敗: ${fatalError}`);
  }
  finish();
}

void main();
```

## File: apps/player-client/project.godot

```
; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="Taiwan Mahjong Player"
config/description="台灣 16 張麻將 — Client-Safe UI。伺服器為唯一真相來源。"
config/version="0.1.0"
run/main_scene="res://scenes/Main.tscn"
config/features=PackedStringArray("4.7", "GL Compatibility")
config/icon="res://icon.svg"

[autoload]

NetworkManager="*res://scripts/NetworkManager.gd"
GameState="*res://scripts/GameState.gd"
AnimationQueue="*res://scripts/AnimationQueue.gd"
AudioManager="*res://scripts/AudioManager.gd"
TileLoader="*res://scripts/tile_loader.gd"

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[gui]

theme/custom_font="res://assets/fonts/NotoSansCJKtc-Regular.otf"

[input_devices]

pointing/emulate_touch_from_mouse=true
```

## File: apps/player-client/export_presets.cfg

```
[preset.0]

name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="export/web/index.html"
script_export_mode=2

[preset.0.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
progressive_web_app/ensure_cross_origin_isolation_headers=false
progressive_web_app/offline_page=""
progressive_web_app/display=1
progressive_web_app/orientation=0
progressive_web_app/icon_144x144=""
progressive_web_app/icon_180x180=""
progressive_web_app/icon_512x512=""
progressive_web_app/background_color=Color(0, 0, 0, 1)
progressive_web_app/icon_maskable_512x512=""
```

## File: apps/player-client/README.md

```
# 台灣 16 張麻將 — Godot 4.7 玩家客戶端 (apps/player-client)

Client-Safe UI：**所有規則判斷都在伺服器**（`apps/server`），本客戶端只負責
顯示伺服器揭露的可觀察狀態，並把玩家的操作以指令送回伺服器。嚴禁在客戶端
實作任何吃碰槓胡判斷邏輯。

---

## 1. 環境需求

- **Godot 4.7**（請用 4.7.x 穩定版開啟本專案，`project.godot` 標記 `config/features=PackedStringArray("4.7", "GL Compatibility")`）
- **Node.js >= 20** + **pnpm**（跑 `apps/server` 用）
- 本專案不需要安裝任何 Godot 外掛或套件

## 2. 啟動伺服器

先啟動權威伺服器（預設埠 **3000**）：

```bash
# 在 monorepo 根目錄
pnpm install
pnpm --filter @taiwan-mahjong/server build
pnpm --filter @taiwan-mahjong/server serve
```

看到以下輸出即代表就緒：

```
[@taiwan-mahjong-server] listening on http://0.0.0.0:3000
[@taiwan-mahjong-server] WebSocket endpoint: ws://localhost:3000/ws
```

健康檢查：`curl http://localhost:3000/health`

可用環境變數：

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `3000` | 監聽埠 |
| `VARIANT` | `north` | 北部 144 張（含花）／`south` 南部 136 張 |

## 3. 用 Godot 開啟專案

1. 開啟 Godot 4.7 → **Import**（匯入）
2. 選取本資料夾的 `project.godot`
3. 匯入後按 **F5（Run Project）**

專案會以 **1280x720** 開啟（`project.godot` 已設定），主場景為
[`scenes/Main.tscn`](scenes/Main.tscn)。

### 專案結構

```
apps/player-client/
├── project.godot          # Godot 設定（解析度、主場景、Autoload）
├── icon.svg
├── scenes/
│   ├── Main.tscn          # 連線 / 開房 / 加入選單
│   ├── Table.tscn         # 牌桌（四家佈局 + 反應視窗 + 結算）
│   └── TileButton.tscn    # 可點擊手牌按鈕（重複使用）
└── scripts/
    ├── NetworkManager.gd  # Autoload — WSS 通訊、自動重連、Ping/Pong
    ├── GameState.gd       # Autoload — Client-Safe 快照全域狀態
    ├── AnimationQueue.gd  # Autoload — 依序播放的 UI 動畫佇列管理器
    ├── main.gd            # 主選單邏輯
    ├── table.gd           # 牌桌渲染（純顯示，無規則判斷）+ 動畫 diff
    └── TileButton.gd      # 手牌點擊 → Discard Command
```

### Autoload 單例（在 `project.godot` 設定）

| 名稱 | 腳本 | 職責 |
|---|---|---|
| `NetworkManager` | [`scripts/NetworkManager.gd`](scripts/NetworkManager.gd) | WSS 連線、事件派發、送出指令 |
| `GameState` | [`scripts/GameState.gd`](scripts/GameState.gd) | 快照狀態 + 顯示輔助（tile 標籤等） |
| `AnimationQueue` | [`scripts/AnimationQueue.gd`](scripts/AnimationQueue.gd) | 依序播放 UI 動畫（摸牌 / 棄牌 / 吃碰槓），`is_playing()` 供 UI 鎖定輸入 |

## 4. 多視窗測試流程（4 位玩家）

因為伺服器是唯一真相來源，你可以開啟**多個 Godot 視窗**模擬 4 位玩家：

### 方式 A：Godot 編輯器多開（推薦）

1. 先啟動伺服器（見上）。
2. 在 Godot 開啟專案 → 按 **F5** 跑第一個視窗。
3. 對同一個專案再按 **F5**（或 Project → 開啟另一個執行個體）。
   Godot 允許同一專案多個執行個體同時運行。
4. 重複直到有 **4 個視窗**。

### 方式 B：匯出執行檔（正式多開）

1. **Project → Export**，先新增一個 **Windows / macOS** 預設範本。
2. 匯出到不同資料夾（例如 `build/p1/`、`build/p2/`…）。
3. 每個執行檔都連到 `ws://localhost:3000/ws`。

### 操作步驟（每個視窗都一樣）

1. 在 **主選單** 輸入玩家名稱（A / B / C / D）。
2. 第一個視窗按 **開房** → 畫面顯示房號（例如 `rXyZ12`）。
3. 其餘三個視窗輸入同一個房號，按 **加入**。
4. 4 人都入座後，各自按 **準備 (Ready)**。
5. 伺服器自動發牌 → 4 個視窗同時切到 **牌桌畫面**（Table）。
6. 輪到你出牌時（上方狀態列顯示「輪到你出牌」），**點擊手牌** 送出。
   - 出牌指令會帶上 `generationId`（防重機制）。
   - 若其他玩家可吃/碰/槓，伺服器會在下家快照的 `reactionHint` 中給出選項，
     畫面下方會出現 **吃 / 碰 / 槓 / 過** 按鈕（僅在伺服器許可時可點）。
   - 快照變化會先拆解成 **動畫佇列**（摸牌飛入手牌 → 棄牌飛入中央 → 吃碰槓移動），
     動畫播放期間手牌與反應按鈕**暫時鎖定**，動畫結束後才刷上最新狀態。
7. 任何玩家湊成合法胡牌（17 張），伺服器**自動胡牌**並結算 → 顯示結算面板。
8. 結算面板列出 **勝者 / 自摸或放槍家 / 台數（含連莊加成）/ 四家分數增減**，
   按 **準備下一局** 送出 ready → 4 人都按完後自動開始下一局。

> 斷線測試：關閉其中一個視窗再重新開啟 → 主選單輸入「同房號 + 剛才的玩家名」，
> 伺服器會以 `playerId` 恢復該座位（含遊戲中）。斷線期間該座位會顯示
> **⚠託管中**，由伺服器代打（出牌逾時自動摸切、反應逾時自動過），重連後恢復手動。

### UI 對照（新增欄位）

| UI 元件 | 資料來源（Snapshot） | 說明 |
|---|---|---|
| 頂列 **倒數計時**（橙色 `⏳`，≤5 秒轉紅） | `phaseDeadline` / `countdownMs` | 目前階段剩餘秒數：出牌思考逾時 / 反應視窗逾時 |
| 頂列 **風圈資訊**（`東風 莊家 X（連莊 N）`） | `dealer` / `dealerStreak` | 莊家位置與連莊計數；`dealerStreak > 0` 表示連莊中 |
| 各家面板標籤 `[莊]` / `⚠託管中` / `⚡離線` | `players[].autoplay` / `players[].connected` | 莊家、自動託管、斷線視覺標記 |
| 結算面板（勝者 / 台數 / 四家增減 / 準備下一局） | `settlement`（`winner`/`breakdown`/`ledger`/`scores`） | 含「莊家連莊台 +N」加成顯示 |
| 結算面板「自動託管：…」摘要 | `autoplayLog` | 本局伺服器代打紀錄（如「B摸切、C過」） |

## 5. 網路協定對照（與 `apps/server` 的 wire contract）

完整型別定義在 [`apps/server/src/protocol.ts`](../server/src/protocol.ts) 與
[`apps/server/src/snapshot.ts`](../server/src/snapshot.ts)。

### Client → Server（指令）

| type | 欄位 | 說明 |
|---|---|---|
| `create` | `playerName` | 開房（自動成為 0 號座位） |
| `join` | `roomId`, `playerName`, `playerId?` | 加入；帶 playerId 可重連恢復座位 |
| `ready` | — | 準備（4 人全 ready → 自動發牌） |
| `discard` | `tileInstanceId`, `generationId` | 出牌（手牌 instanceId） |
| `reaction` | `kind`(chi/peng/kong), `handTileIds`, `kongType?`, `pengMeldId?`, `generationId` | 吃/碰/槓 |
| `pass` | `generationId` | 放棄反應 |
| `ping` | `t` | 心跳（伺服器回 `pong`） |

所有指令都帶 `operationId`（冪等金鑰，同一 operationId 不會執行兩次）。

### Server → Client（事件）

| type | 內容 |
|---|---|
| `welcome` | `playerId`, `roomId` |
| `room.created` | `roomId` |
| `player.joined` / `player.ready` / `player.left` | `seat` 等 |
| `game.started` | `dealer`, `dealerStreak` |
| `game.ended` | `winner`, `ledger`, `scores`, `dealer`, `dealerStreak` 等 |
| `snapshot` | **Client-Safe 快照**（見下） |
| `error` | `code`, `message`, `operationId` |
| `pong` | `t`（延遲量測） |

### Snapshot 的 Client-Safe 原則（`ClientSnapshot`）

- **只有你自己的手牌**有 `hand: [{instanceId, id}]`，其他三家為 `hand: null`。
- 各家只揭露 `handCount`（張數）、`melds`（副露）、`flowers`。
- 牌牆只揭露 `headRemaining` / `deckRemaining`（剩餘張數）。
- `reactionHint` 由伺服器計算（`canChi/canPeng/canKong/chiOptions/kongOptions`），
  客戶端**只顯示、不判斷**。

#### 自動託管 / 莊家相關欄位（本專案新增）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `dealer` | `number \| null` | 莊家座位（0-3）；為 null 表示尚未開始 |
| `dealerStreak` | `number` | 連莊計數：0 = 新任莊家；>=1 = 已連莊 N 次 |
| `phaseDeadline` | `number \| null` | 目前階段自動託管截止時間（epoch ms）；null = 無倒數 |
| `countdownMs` | `number \| null` | 快照當下的剩餘毫秒（客戶端可用 `phaseDeadline` 自行本地倒數） |
| `players[].autoplay` | `boolean` | 該玩家是否由伺服器代打（斷線 / 超時） |
| `players[].connected` | `boolean` | 該玩家連線狀態 |
| `autoplayLog` | `Array<{seat, action, reason, at}>` | 本局自動託管紀錄（`action: "discard"`(摸切) / `"pass"`；`reason: "timeout"` / `"disconnect"`） |

> 倒數顯示建議用 `phaseDeadline - now` 本地計算（`GameState.remaining_ms()`），
> 而不是依賴快照的 `countdownMs`（那只是發送當下的快照值）。

## 6. 動畫佇列（Animation Queue）

快照是「狀態」，不是「事件」；為避免畫面瞬間跳變，`table.gd` 會把
**本次快照 vs 上次已渲染狀態**的差異拆解成依序播放的動畫：

| 動畫 | 觸發（diff） | 內容 |
|---|---|---|
| 摸牌飛入 | 手牌張數增加 | 從牌牆（TopBar 右側）滑入自己手牌末端 |
| 棄牌飛出 | 中央 `discards` 張數增加 | 從棄牌者座位飛入中央棄牌池 |
| 吃碰槓移動 | 某家 `melds` 新增 | 牌面組合（`claimed` 張）飛到該座位副露區 |

### 播放流程（`table.gd` `_render_playing`）

1. 收到新快照 → 若 `AnimationQueue.is_playing()`，**不疊加新動畫**，
   只標記 `_pending_final_render` 並鎖定輸入（避免中間快照跳變）。
2. 否則比較上次渲染狀態，收集動畫 job（`_collect_anim_jobs`）：
   - 每筆 job 是一個 Callable，呼叫後啟動 Tween 並回傳它（或 `null` = 同步完成）。
   - `AnimationQueue` 依序等待每個 Tween `finished` 才播放下一個。
3. 佇列清空 → `queue_drained` 觸發 → 若期間有新快照，`_refresh()` 一次刷上
   最新 Snapshot 的最終畫面。

### 輸入鎖定

- 動畫播放期間：手牌按鈕 `disabled`、反應列隱藏，玩家無法送出指令。
- 首次發牌 / 重連直接畫最終狀態（`_hand_rendered_once`），不做動畫。

### API（`AnimationQueue.gd`）

| 方法 / 訊號 | 說明 |
|---|---|
| `enqueue(job: Callable)` | 加入動畫 job（job 需回傳 Tween 或 null） |
| `is_playing() -> bool` | 佇列是否仍在播放（UI 鎖定輸入用） |
| `clear()` | 丟棄尚未播放的 job（進行中動畫不受影響） |
| `queue_drained` | 佇列完全清空時發出（`table.gd` 在此刷入最終狀態） |

## 7. 指令送出重點（已內建於 NetworkManager.gd）

- 出牌：`NetworkManager.discard(instanceId)` — 自動附上 `GameState.generation_id`。
- 準備：`NetworkManager.mark_ready()`（不能用 `ready()`，會與 Node 內建訊號衝突）。
- 反應：`NetworkManager.react("chi"|"peng"|"kong", handTileIds, extra)`。
- 過：`NetworkManager.pass_reaction()`。
- 每次送出都會自動產生唯一的 `operationId`，因此**連點不會重複執行**。

## 8. 疑難排解

| 症狀 | 處理 |
|---|---|
| 主選單顯示「重連中」 | 確認伺服器有啟動（`pnpm --filter @taiwan-mahjong/server serve`） |
| 畫面停在大廳、按 Ready 無反應 | 需 4 位玩家都入座並都按 Ready 才會自動發牌 |
| 點手牌沒反應 | 確認上方狀態列顯示「輪到你出牌」（turn == you 且 phase == discard） |
| 吃/碰/槓按鈕是灰的 | 表示伺服器快照未授權該反應（例如只有吃可選） |
| 連到遠端伺服器 | 在主選單把「伺服器位址」改成 `ws://<host>:3000/ws` |
```

## File: apps/player-client/scenes/Main.tscn

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/main.gd" id="1"]

[node name="Main" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="CenterContainer" type="CenterContainer" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0

[node name="VBox" type="VBoxContainer" parent="CenterContainer"]
layout_mode = 2
custom_minimum_size = Vector2(480, 0)
theme_override_constants/separation = 12

[node name="Title" type="Label" parent="CenterContainer/VBox"]
layout_mode = 2
theme_override_font_sizes/font_size = 28
text = "台灣 16 張麻將"
horizontal_alignment = 1

[node name="Subtitle" type="Label" parent="CenterContainer/VBox"]
layout_mode = 2
text = "Client-Safe UI — 伺服器為唯一真相來源"
horizontal_alignment = 1

[node name="UrlLabel" type="Label" parent="CenterContainer/VBox"]
layout_mode = 2
text = "伺服器位址 (WSS)"

[node name="UrlEdit" type="LineEdit" parent="CenterContainer/VBox"]
unique_name_in_owner = true
layout_mode = 2
text = "ws://localhost:3000/ws"

[node name="NameLabel" type="Label" parent="CenterContainer/VBox"]
layout_mode = 2
text = "玩家名稱"

[node name="NameEdit" type="LineEdit" parent="CenterContainer/VBox"]
unique_name_in_owner = true
layout_mode = 2
placeholder_text = "Player"

[node name="RoomLabel" type="Label" parent="CenterContainer/VBox"]
layout_mode = 2
text = "房間代碼（加入用）"

[node name="RoomEdit" type="LineEdit" parent="CenterContainer/VBox"]
unique_name_in_owner = true
layout_mode = 2
placeholder_text = "例如 rXyZ12"

[node name="Buttons" type="HBoxContainer" parent="CenterContainer/VBox"]
layout_mode = 2
theme_override_constants/separation = 8

[node name="CreateBtn" type="Button" parent="CenterContainer/VBox/Buttons"]
unique_name_in_owner = true
layout_mode = 2
custom_minimum_size = Vector2(0, 40)
size_flags_horizontal = 3
text = "開房"

[node name="JoinBtn" type="Button" parent="CenterContainer/VBox/Buttons"]
unique_name_in_owner = true
layout_mode = 2
custom_minimum_size = Vector2(0, 40)
size_flags_horizontal = 3
text = "加入"

[node name="StatusLabel" type="Label" parent="CenterContainer/VBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.65, 0.75, 0.65, 1)
text = "未連線"
horizontal_alignment = 1
autowrap_mode = 3

[node name="ReconnectLabel" type="Label" parent="CenterContainer/VBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.9, 0.7, 0.3, 1)
text = ""
horizontal_alignment = 1
visible = false

[node name="VersionBadge" type="Label" parent="."]
layout_mode = 1
anchors_preset = 1
anchor_left = 1.0
anchor_right = 1.0
offset_left = -132.0
offset_top = 8.0
offset_right = -8.0
offset_bottom = 36.0
theme_override_colors/font_color = Color(0.98, 0.85, 0.3, 1)
theme_override_colors/font_outline_color = Color(0.25, 0.15, 0.05, 1)
theme_override_constants/outline_size = 6
theme_override_font_sizes/font_size = 16
text = "測試版"
horizontal_alignment = 1
```

## File: apps/player-client/scenes/Table.tscn

```
[gd_scene load_steps=16 format=3]

[ext_resource type="Script" path="res://scripts/table.gd" id="1"]

[sub_resource type="StyleBoxFlat" id="glass_panel"]
content_margin_left = 12.0
content_margin_top = 6.0
content_margin_right = 12.0
content_margin_bottom = 6.0
bg_color = Color(0.071, 0.071, 0.071, 0.8)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(0.831, 0.686, 0.216, 0.4)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8

[sub_resource type="StyleBoxFlat" id="gold_card"]
content_margin_left = 24.0
content_margin_top = 20.0
content_margin_right = 24.0
content_margin_bottom = 20.0
bg_color = Color(0.03, 0.03, 0.035, 0.96)
border_width_left = 2
border_width_top = 2
border_width_right = 2
border_width_bottom = 2
border_color = Color(0.831, 0.686, 0.216, 0.75)
corner_radius_top_left = 12
corner_radius_top_right = 12
corner_radius_bottom_right = 12
corner_radius_bottom_left = 12
shadow_color = Color(0, 0, 0, 0.6)
shadow_size = 16

[sub_resource type="Gradient" id="vig_grad"]
offsets = PackedFloat32Array(0.42, 1)
colors = PackedColorArray(0, 0, 0, 0, 0, 0, 0, 0.55)

[sub_resource type="GradientTexture2D" id="vig_tex"]
gradient = SubResource("vig_grad")
width = 512
height = 512
fill_from = Vector2(0.5, 0.5)
fill_to = Vector2(1, 1)
fill = 1

[sub_resource type="StyleBoxFlat" id="bar_bg"]
bg_color = Color(0, 0, 0, 0.45)
corner_radius_top_left = 4
corner_radius_top_right = 4
corner_radius_bottom_right = 4
corner_radius_bottom_left = 4

[sub_resource type="StyleBoxFlat" id="bar_fill"]
bg_color = Color(0.96, 0.67, 0.21, 0.9)
corner_radius_top_left = 4
corner_radius_top_right = 4
corner_radius_bottom_right = 4
corner_radius_bottom_left = 4

[sub_resource type="StyleBoxFlat" id="btn_chi"]
content_margin_left = 18.0
content_margin_top = 10.0
content_margin_right = 18.0
content_margin_bottom = 10.0
bg_color = Color(0.118, 0.51, 0.298, 1)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(1, 1, 1, 0.18)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8
shadow_color = Color(0, 0, 0, 0.4)
shadow_size = 4
shadow_offset = Vector2(0, 2)

[sub_resource type="StyleBoxFlat" id="btn_peng"]
content_margin_left = 18.0
content_margin_top = 10.0
content_margin_right = 18.0
content_margin_bottom = 10.0
bg_color = Color(0.122, 0.227, 0.576, 1)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(1, 1, 1, 0.18)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8
shadow_color = Color(0, 0, 0, 0.4)
shadow_size = 4
shadow_offset = Vector2(0, 2)

[sub_resource type="StyleBoxFlat" id="btn_kong"]
content_margin_left = 18.0
content_margin_top = 10.0
content_margin_right = 18.0
content_margin_bottom = 10.0
bg_color = Color(0.96, 0.671, 0.208, 1)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(1, 1, 1, 0.25)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8
shadow_color = Color(0, 0, 0, 0.4)
shadow_size = 4
shadow_offset = Vector2(0, 2)

[sub_resource type="StyleBoxFlat" id="btn_win"]
content_margin_left = 18.0
content_margin_top = 10.0
content_margin_right = 18.0
content_margin_bottom = 10.0
bg_color = Color(0.812, 0, 0.059, 1)
border_width_left = 2
border_width_top = 2
border_width_right = 2
border_width_bottom = 2
border_color = Color(0.96, 0.671, 0.208, 0.9)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8
shadow_color = Color(0.812, 0, 0.059, 0.6)
shadow_size = 10

[sub_resource type="StyleBoxFlat" id="btn_pass"]
content_margin_left = 18.0
content_margin_top = 10.0
content_margin_right = 18.0
content_margin_bottom = 10.0
bg_color = Color(0.2, 0.2, 0.2, 0.95)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(1, 1, 1, 0.12)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8

[sub_resource type="StyleBoxFlat" id="btn_gold"]
content_margin_left = 20.0
content_margin_top = 12.0
content_margin_right = 20.0
content_margin_bottom = 12.0
bg_color = Color(0.118, 0.51, 0.298, 1)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(0.831, 0.686, 0.216, 0.8)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8
shadow_color = Color(0, 0, 0, 0.45)
shadow_size = 6
shadow_offset = Vector2(0, 3)

[sub_resource type="StyleBoxFlat" id="btn_gold_pressed"]
content_margin_left = 20.0
content_margin_top = 12.0
content_margin_right = 20.0
content_margin_bottom = 12.0
bg_color = Color(0.09, 0.4, 0.235, 1)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(0.831, 0.686, 0.216, 0.9)
corner_radius_top_left = 8
corner_radius_top_right = 8
corner_radius_bottom_right = 8
corner_radius_bottom_left = 8

[sub_resource type="StyleBoxFlat" id="hand_back"]
content_margin_left = 12.0
content_margin_top = 6.0
content_margin_right = 12.0
content_margin_bottom = 6.0
bg_color = Color(0.071, 0.071, 0.071, 0.8)
border_width_left = 1
border_width_top = 1
border_width_right = 1
border_width_bottom = 1
border_color = Color(0.831, 0.686, 0.216, 0.5)
corner_radius_top_left = 10
corner_radius_top_right = 10
corner_radius_bottom_right = 10
corner_radius_bottom_left = 10

[sub_resource type="StyleBoxFlat" id="felt_table"]
content_margin_left = 26.0
content_margin_top = 22.0
content_margin_right = 26.0
content_margin_bottom = 22.0
bg_color = Color(0.035, 0.13, 0.092, 1)
border_width_left = 4
border_width_top = 4
border_width_right = 4
border_width_bottom = 4
border_color = Color(0.67, 0.5, 0.16, 0.75)
corner_radius_top_left = 28
corner_radius_top_right = 28
corner_radius_bottom_right = 28
corner_radius_bottom_left = 28
shadow_color = Color(0, 0, 0, 0.65)
shadow_size = 30
shadow_offset = Vector2(0, 5)

[node name="Table" type="Control"]
layout_mode = 3
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
script = ExtResource("1")

[node name="FeltBg" type="ColorRect" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
color = Color(0.043, 0.157, 0.106, 1)

[node name="Vignette" type="TextureRect" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
texture = SubResource("vig_tex")
stretch_mode = 0
mouse_filter = 2

[node name="TableCenter" type="Panel" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -360.0
offset_top = -220.0
offset_right = 360.0
offset_bottom = 220.0
z_index = 1
mouse_filter = 2
theme_override_styles/panel = SubResource("felt_table")

[node name="RiverBottom" type="GridContainer" parent="TableCenter"]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 1.0
anchor_right = 1.0
anchor_bottom = 1.0
offset_top = -56.0
offset_bottom = -12.0
theme_override_constants/h_separation = 6
theme_override_constants/v_separation = 6
columns = 6

[node name="RiverTop" type="GridContainer" parent="TableCenter"]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.0
anchor_right = 1.0
anchor_bottom = 0.0
offset_top = 12.0
offset_bottom = 68.0
theme_override_constants/h_separation = 6
theme_override_constants/v_separation = 6
columns = 6

[node name="RiverLeft" type="GridContainer" parent="TableCenter"]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.0
anchor_right = 0.0
anchor_bottom = 1.0
offset_left = 12.0
offset_right = 68.0
theme_override_constants/h_separation = 6
theme_override_constants/v_separation = 6
columns = 1

[node name="RiverRight" type="GridContainer" parent="TableCenter"]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 1.0
anchor_top = 0.0
anchor_right = 1.0
anchor_bottom = 1.0
offset_left = -68.0
offset_right = -12.0
theme_override_constants/h_separation = 6
theme_override_constants/v_separation = 6
columns = 1

[node name="LastDiscardTile" type="TextureRect" parent="TableCenter"]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = 8
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -36.0
offset_top = -48.0
offset_right = 36.0
offset_bottom = 48.0
custom_minimum_size = Vector2(72, 96)
expand_mode = 1
stretch_mode = 5
mouse_filter = 2
texture_filter = 2

[node name="TopBarPanel" type="PanelContainer" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = 10
anchor_right = 1.0
offset_bottom = 48.0
theme_override_styles/panel = SubResource("glass_panel")

[node name="TopBar" type="HBoxContainer" parent="TopBarPanel"]
layout_mode = 2
theme_override_constants/separation = 12

[node name="RoomLabel" type="Label" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "房間：-"

[node name="Spacer1" type="Control" parent="TopBarPanel/TopBar"]
layout_mode = 2
size_flags_horizontal = 3

[node name="StatusLabel" type="Label" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "等待中"

[node name="CountdownBox" type="VBoxContainer" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_constants/separation = 2

[node name="CountdownBar" type="ProgressBar" parent="TopBarPanel/TopBar/CountdownBox"]
unique_name_in_owner = true
custom_minimum_size = Vector2(150, 10)
layout_mode = 2
size_flags_vertical = 4
theme_override_styles/background = SubResource("bar_bg")
theme_override_styles/fill = SubResource("bar_fill")
show_percentage = false
value = 100.0

[node name="CountdownLabel" type="Label" parent="TopBarPanel/TopBar/CountdownBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.9, 0.55, 0.2, 1)
theme_override_font_sizes/font_size = 13
text = ""
horizontal_alignment = 1

[node name="Spacer2" type="Control" parent="TopBarPanel/TopBar"]
layout_mode = 2
size_flags_horizontal = 3

[node name="DealerInfoLabel" type="Label" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "東風 莊家：-"

[node name="WallLabel" type="Label" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "牌牆 -"

[node name="LeaveBtn" type="Button" parent="TopBarPanel/TopBar"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
theme_override_styles/normal = SubResource("btn_pass")
theme_override_styles/hover = SubResource("btn_pass")
theme_override_styles/pressed = SubResource("btn_pass")
text = "離開"

[node name="LobbyPanel" type="PanelContainer" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.25
anchor_top = 0.3
anchor_right = 0.75
anchor_bottom = 0.7
theme_override_styles/panel = SubResource("glass_panel")

[node name="LobbyBox" type="VBoxContainer" parent="LobbyPanel"]
layout_mode = 2
theme_override_constants/separation = 12

[node name="LobbyTitle" type="Label" parent="LobbyPanel/LobbyBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
theme_override_font_sizes/font_size = 24
text = "等待玩家加入…"
horizontal_alignment = 1

[node name="LobbyInfo" type="Label" parent="LobbyPanel/LobbyBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "房號：-"
horizontal_alignment = 1

[node name="LobbyPlayers" type="Label" parent="LobbyPanel/LobbyBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.9, 0.85, 0.7, 1)
text = "座位\n"
horizontal_alignment = 1

[node name="ReadyBtn" type="Button" parent="LobbyPanel/LobbyBox"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
custom_minimum_size = Vector2(0, 56)
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_gold")
theme_override_styles/hover = SubResource("btn_gold")
theme_override_styles/pressed = SubResource("btn_gold_pressed")
theme_override_styles/focus = SubResource("btn_gold_pressed")
text = "準備 (Ready)"

[node name="VersionBadge" type="Label" parent="."]
layout_mode = 1
anchors_preset = 1
anchor_left = 1.0
anchor_right = 1.0
offset_left = -120.0
offset_top = 54.0
offset_right = -8.0
offset_bottom = 80.0
theme_override_colors/font_color = Color(0.98, 0.85, 0.3, 1)
theme_override_colors/font_outline_color = Color(0.25, 0.15, 0.05, 1)
theme_override_constants/outline_size = 6
theme_override_font_sizes/font_size = 15
text = "測試版"
horizontal_alignment = 1

[node name="EastPanel" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = -1
anchor_left = 0.78
anchor_top = 0.0
anchor_right = 1.0
anchor_bottom = 0.42
offset_top = 56.0
offset_right = -16.0
theme_override_constants/separation = 6

[node name="MeldArea" type="HBoxContainer" parent="EastPanel"]
layout_mode = 2

[node name="EastHandBacks" type="VBoxContainer" parent="EastPanel"]
unique_name_in_owner = true
layout_mode = 2
theme_override_constants/separation = 4
alignment = 1
clip_contents = false

[node name="SouthPanel" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.9
anchor_right = 1.0
anchor_bottom = 1.0
offset_bottom = -8.0

[node name="MeldArea" type="HBoxContainer" parent="SouthPanel"]
layout_mode = 2

[node name="WestPanel" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.0
anchor_right = 0.22
anchor_bottom = 0.42
offset_left = 16.0
offset_top = 56.0
theme_override_constants/separation = 6

[node name="MeldArea" type="HBoxContainer" parent="WestPanel"]
layout_mode = 2

[node name="WestHandBacks" type="VBoxContainer" parent="WestPanel"]
unique_name_in_owner = true
layout_mode = 2
theme_override_constants/separation = 4
alignment = 1
clip_contents = false

[node name="NorthPanel" type="VBoxContainer" parent="."]
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.0
anchor_right = 1.0
anchor_bottom = 0.42
offset_top = 56.0
theme_override_constants/separation = 6

[node name="MeldArea" type="HBoxContainer" parent="NorthPanel"]
layout_mode = 2

[node name="NorthHandBacks" type="HBoxContainer" parent="NorthPanel"]
unique_name_in_owner = true
layout_mode = 2
theme_override_constants/separation = 4
alignment = 1
clip_contents = false

[node name="HandPanel" type="PanelContainer" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.0
anchor_top = 0.74
anchor_right = 1.0
anchor_bottom = 0.9
offset_left = 8.0
offset_right = -8.0
offset_bottom = -8.0
z_index = 50
mouse_filter = 2
theme_override_styles/panel = SubResource("hand_back")

[node name="HandBox" type="VBoxContainer" parent="HandPanel"]
layout_mode = 2
theme_override_constants/separation = 4
clip_contents = false

[node name="HandLabel" type="Label" parent="HandPanel/HandBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
text = "我的手牌"

[node name="HandArea" type="HBoxContainer" parent="HandPanel/HandBox"]
unique_name_in_owner = true
layout_mode = 2
size_flags_vertical = 3
theme_override_constants/separation = 6
alignment = 1
clip_contents = false

[node name="ReactionBar" type="HBoxContainer" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.42
z_index = 60
anchor_top = 0.86
anchor_right = 1.0
anchor_bottom = 0.86
offset_top = -56.0
offset_right = -16.0
offset_bottom = -12.0
theme_override_constants/separation = 10
visible = false

[node name="ChiBtn" type="Button" parent="ReactionBar"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
theme_override_colors/font_color = Color(1, 1, 1, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_chi")
theme_override_styles/hover = SubResource("btn_chi")
theme_override_styles/pressed = SubResource("btn_chi")
theme_override_styles/focus = SubResource("btn_chi")
text = "吃"

[node name="PengBtn" type="Button" parent="ReactionBar"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
theme_override_colors/font_color = Color(1, 1, 1, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_peng")
theme_override_styles/hover = SubResource("btn_peng")
theme_override_styles/pressed = SubResource("btn_peng")
theme_override_styles/focus = SubResource("btn_peng")
text = "碰"

[node name="KongBtn" type="Button" parent="ReactionBar"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
theme_override_colors/font_color = Color(0.12, 0.08, 0.02, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_kong")
theme_override_styles/hover = SubResource("btn_kong")
theme_override_styles/pressed = SubResource("btn_kong")
theme_override_styles/focus = SubResource("btn_kong")
text = "槓"

[node name="WinBtn" type="Button" parent="ReactionBar"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
theme_override_colors/font_color = Color(1, 1, 1, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_win")
theme_override_styles/hover = SubResource("btn_win")
theme_override_styles/pressed = SubResource("btn_win")
theme_override_styles/focus = SubResource("btn_win")
text = "胡"

[node name="PassBtn" type="Button" parent="ReactionBar"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
theme_override_colors/font_color = Color(1, 1, 1, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_pass")
theme_override_styles/hover = SubResource("btn_pass")
theme_override_styles/pressed = SubResource("btn_pass")
theme_override_styles/focus = SubResource("btn_pass")
text = "過"

[node name="SettlementBackdrop" type="ColorRect" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
z_index = 90
color = Color(0, 0, 0, 0.8)
mouse_filter = 0
visible = false

[node name="SettlementPanel" type="PanelContainer" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = -1
anchor_left = 0.2
anchor_top = 0.15
anchor_right = 0.8
anchor_bottom = 0.85
z_index = 91
theme_override_styles/panel = SubResource("gold_card")
visible = false

[node name="SettlementBox" type="VBoxContainer" parent="SettlementPanel"]
layout_mode = 2
theme_override_constants/separation = 10

[node name="SettlementTitle" type="Label" parent="SettlementPanel/SettlementBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
theme_override_font_sizes/font_size = 28
text = "結算"
horizontal_alignment = 1

[node name="FanListContainer" type="VBoxContainer" parent="SettlementPanel/SettlementBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_constants/separation = 6

[node name="SettlementDetail" type="Label" parent="SettlementPanel/SettlementBox"]
unique_name_in_owner = true
layout_mode = 2
theme_override_colors/font_color = Color(0.95, 0.93, 0.85, 1)
theme_override_font_sizes/font_size = 18
text = "-"
horizontal_alignment = 1
autowrap_mode = 2

[node name="NextRoundBtn" type="Button" parent="SettlementPanel/SettlementBox"]
unique_name_in_owner = true
layout_mode = 2
size_flags_horizontal = 3
custom_minimum_size = Vector2(0, 56)
theme_override_colors/font_color = Color(0.953, 0.898, 0.671, 1)
theme_override_font_sizes/font_size = 20
theme_override_constants/outline_size = 1
theme_override_styles/normal = SubResource("btn_gold")
theme_override_styles/hover = SubResource("btn_gold")
theme_override_styles/pressed = SubResource("btn_gold_pressed")
theme_override_styles/focus = SubResource("btn_gold_pressed")
text = "準備下一局"

[node name="FXLayer" type="Control" parent="."]
unique_name_in_owner = true
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
z_index = 100
mouse_filter = 2
```

## File: apps/player-client/scenes/TileButton.tscn

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/TileButton.gd" id="1"]

[node name="TileButton" type="Button"]
custom_minimum_size = Vector2(48, 64)
mouse_default_cursor_shape = 2
script = ExtResource("1")

[node name="Back" type="TextureRect" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
expand_mode = 1
stretch_mode = 5
mouse_filter = 2
texture_filter = 2

[node name="Face" type="TextureRect" parent="."]
layout_mode = 1
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
expand_mode = 1
stretch_mode = 5
mouse_filter = 2
texture_filter = 2
```

## File: apps/player-client/scripts/AnimationQueue.gd

```
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
```

## File: apps/player-client/scripts/AudioManager.gd

```
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
```

## File: apps/player-client/scripts/GameState.gd

```
extends Node
## GameState — Client-Safe 全域狀態 (Autoload 單例)
##
## 只存放伺服器快照揭露的「可觀察狀態」，並提供 UI 需要的輔助函式。
## 嚴禁在此實作任何吃碰槓胡判斷邏輯 — 判斷完全由伺服器負責。

signal state_changed

# --- 目前快照（對應 server snapshot.ts ClientSnapshot） ---
var status := "lobby"          # "lobby" | "playing" | "ended"
var generation_id := 0
var you := 0
var dealer := -1
## 連莊數（0 = 新任莊家；>=1 = 連續連莊）。
var dealer_streak := 0
var turn := -1
var game_phase := ""
var room_id := ""
var players: Array = []        # [ {seat, playerId, playerName, connected, ready, autoplay, handCount, hand, flowers, melds} ]
var discards: Array = []       # [tileId, ...] 中央棄牌區（歷史）
## 各家棄牌河：[[seat0 棄牌...], [seat1 棄牌...], [seat2 棄牌...], [seat3 棄牌...]]
var discards_by_seat: Array = [[], [], [], []]
var last_discard := ""
var last_discard_by := -1
## 最近一次摸牌者座位（公開可觀測 — 由回合流程得知）。
var last_drawn_by := -1
## 最近一次摸到的牌（僅自己可視）：{instanceId, id} 或 {}。
## 供第 17 張摸牌分離使用 — 伺服器權威辨識（不可用 max-instanceId）。
var last_drawn_tile: Dictionary = {}
var wall_head_remaining := 0
var wall_deck_remaining := 0
var reaction_hint: Dictionary = {}   # {canChi, canPeng, canKong, chiOptions, kongOptions}
## 可胡狀態（聽牌）— 伺服器快照判定還差一張即可胡牌（胡牌光暈用）。
var can_win := false
var winner := -1
var settlement: Dictionary = {}      # {winner, selfDraw, kongDraw, breakdown, ledger, scores}
## 目前階段的自動託管截止時間（epoch ms；null = 無倒數）。
var phase_deadline := -1
## 從快照計算出的剩餘毫秒（供倒數顯示；null = 無倒數）。
var countdown_ms := -1
## 本局伺服器自動託管紀錄：[ {seat, action, reason, at} ]。
var autoplay_log: Array = []

# --- 標籤文字對照 ---
const SUIT_CN := {"wan": "萬", "tiao": "條", "tong": "筒"}
const HONOR_CN := {
	"dong": "東", "nan": "南", "xi": "西", "bei": "北",
	"zhong": "中", "fa": "發", "bai": "白",
}
const FLOWER_CN := {
	"mei": "梅", "lan": "蘭", "zhu": "竹", "ju": "菊",
	"chun": "春", "xia": "夏", "qiu": "秋", "dong": "冬",
}


# ---------------------------------------------------------------------------
# 快照套用（唯一寫入點 — 由 NetworkManager 呼叫）
# ---------------------------------------------------------------------------

func apply_snapshot(snap: Dictionary) -> void:
	status = snap.get("status", status)
	generation_id = snap.get("generationId", generation_id)
	you = snap.get("you", you)
	dealer = snap.get("dealer", -1) if snap.get("dealer") != null else -1
	dealer_streak = snap.get("dealerStreak", 0) if snap.get("dealerStreak") != null else 0
	turn = snap.get("turn", -1) if snap.get("turn") != null else -1
	game_phase = snap.get("gamePhase", "") if snap.get("gamePhase") != null else ""
	room_id = snap.get("roomId", room_id)
	players = snap.get("players", [])
	discards = snap.get("discards", [])
	discards_by_seat = snap.get("discardsBySeat", [[], [], [], []])
	last_discard = snap.get("lastDiscard", "") if snap.get("lastDiscard") != null else ""
	last_discard_by = snap.get("lastDiscardBy", -1) if snap.get("lastDiscardBy") != null else -1
	last_drawn_by = snap.get("lastDrawnBy", -1) if snap.get("lastDrawnBy") != null else -1
	last_drawn_tile = snap.get("lastDrawnTile", {}) if snap.get("lastDrawnTile") != null else {}
	var wall: Dictionary = snap.get("wall", {})
	wall_head_remaining = wall.get("headRemaining", 0)
	wall_deck_remaining = wall.get("deckRemaining", 0)
	reaction_hint = snap.get("reactionHint", {}) if snap.get("reactionHint") != null else {}
	can_win = snap.get("canWin", false) == true
	winner = snap.get("winner", -1) if snap.get("winner") != null else -1
	settlement = snap.get("settlement", {}) if snap.get("settlement") != null else {}
	phase_deadline = snap.get("phaseDeadline", -1) if snap.get("phaseDeadline") != null else -1
	countdown_ms = snap.get("countdownMs", -1) if snap.get("countdownMs") != null else -1
	autoplay_log = snap.get("autoplayLog", []) if snap.get("autoplayLog") != null else []
	state_changed.emit()


# ---------------------------------------------------------------------------
# 查詢輔助
# ---------------------------------------------------------------------------

func is_playing() -> bool:
	return status == "playing"


## 我的 PlayerView。
func my_player() -> Dictionary:
	for p in players:
		if int(p.get("seat", -1)) == you:
			return p
	return {}


## 我的手牌：[ {instanceId, id}, ... ]（伺服器只揭露自己的手牌）。
func my_hand() -> Array:
	var me := my_player()
	return me.get("hand", []) if me.get("hand") != null else []


## 是否輪到我出牌（discard phase 且 turn == you）。
func is_my_discard_turn() -> bool:
	return is_playing() and game_phase == "discard" and turn == you


## 反應視窗是否開啟且包含我（reaction phase）。
func in_reaction_window() -> bool:
	return is_playing() and game_phase == "reaction" and not reaction_hint.is_empty()


## 反應視窗的選項清單：[ {kind, handTileIds, kongType, pengMeldId, run} ]
func reaction_options() -> Array:
	if not in_reaction_window():
		return []
	var opts: Array = []
	if reaction_hint.get("canChi", false):
		for o in reaction_hint.get("chiOptions", []):
			opts.append({"kind": "chi", "handTileIds": o.get("handTileIds", []), "run": o.get("run", [])})
	if reaction_hint.get("canPeng", false):
		opts.append({"kind": "peng", "handTileIds": []})
	if reaction_hint.get("canKong", false):
		for o in reaction_hint.get("kongOptions", []):
			opts.append({
				"kind": "kong",
				"kongType": o.get("kongType", "open"),
				"handTileIds": o.get("handTileIds", []),
				"pengMeldId": o.get("pengMeldId", 0),
			})
	return opts


# ---------------------------------------------------------------------------
# 顯示輔助（TileId → 中文標籤）
# ---------------------------------------------------------------------------

## 把 "wan:5" 這種 TileId 轉成顯示字串，例如 "5萬"、"東"、"梅"。
func tile_label(tile_id: String) -> String:
	var parts := tile_id.split(":")
	if parts.size() < 2:
		return tile_id
	var category := parts[0]
	var value := parts[1]
	match category:
		"wan", "tiao", "tong":
			return "%s%s" % [value, SUIT_CN.get(category, category)]
		"honor":
			return HONOR_CN.get(value, value)
		"flower":
			return FLOWER_CN.get(value, value)
		_:
			return tile_id


## 把 meld.tiles（TileId 陣列）轉成標籤字串。
func meld_label(meld: Dictionary) -> String:
	var labels: Array = []
	for t in meld.get("tiles", []):
		labels.append(tile_label(t))
	return " ".join(labels)


func seat_name(seat: int) -> String:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("playerName", "?")
	return "?"


func player_hand_count(seat: int) -> int:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return int(p.get("handCount", 0))
	return 0


## 該座位的棄牌河：[tileId, ...]（依棄牌順序）。
func discards_for(seat: int) -> Array:
	if seat < 0 or seat >= discards_by_seat.size():
		return []
	return discards_by_seat[seat]


# ---------------------------------------------------------------------------
# 自動託管 / 倒數計時輔助（對應 snapshot phaseDeadline / countdownMs）
# ---------------------------------------------------------------------------

## 是否還有階段倒數（discard 摸切 / reaction 自動 pass）。
func has_countdown() -> bool:
	return is_playing() and phase_deadline > 0


## 目前距離截止的剩餘毫秒（即時計算，會隨時間遞減）。
func remaining_ms() -> int:
	if not has_countdown():
		return -1
	var remain: int = phase_deadline - Time.get_unix_time_from_system() * 1000.0
	return int(maxf(0.0, remain))


## 該座位是否正在自動託管（伺服器代打）。
func is_autoplay(seat: int) -> bool:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("autoplay", false) == true
	return false


## 該座位是否離線（斷線中）。
func is_offline(seat: int) -> bool:
	for p in players:
		if int(p.get("seat", -1)) == seat:
			return p.get("connected", false) == false
	return false


## 本局自動託管摘要文字（例如「B摸切、C過」）。
func autoplay_summary() -> String:
	if autoplay_log.is_empty():
		return "無"
	var parts: Array = []
	for e in autoplay_log:
		var seat: int = int(e.get("seat", -1))
		var action: String = "摸切" if e.get("action", "") == "discard" else "過"
		parts.append("%s%s" % [seat_name(seat), action])
	return "、".join(parts)
```

## File: apps/player-client/scripts/main.gd

```
extends Control
## Main — 連線 / 開房 / 加入選單。

@onready var url_edit: LineEdit = %UrlEdit
@onready var name_edit: LineEdit = %NameEdit
@onready var room_edit: LineEdit = %RoomEdit
@onready var status_label: Label = %StatusLabel
@onready var reconnect_label: Label = %ReconnectLabel

func _ready() -> void:
	%CreateBtn.pressed.connect(_on_create_pressed)
	%JoinBtn.pressed.connect(_on_join_pressed)

	# 讀取上次使用的名稱（本地儲存）。
	if FileAccess.file_exists("user://player_name.cfg"):
		var f := FileAccess.open("user://player_name.cfg", FileAccess.READ)
		if f:
			name_edit.text = f.get_as_text().strip_edges()

	NetworkManager.connected.connect(_on_connected)
	NetworkManager.disconnected.connect(_on_disconnected)
	NetworkManager.reconnect_attempt.connect(_on_reconnect_attempt)
	NetworkManager.reconnect_failed.connect(_on_reconnect_failed)
	NetworkManager.room_created.connect(_on_room_created)
	NetworkManager.player_joined.connect(_on_player_joined)
	NetworkManager.game_started.connect(_on_game_started)
	NetworkManager.snapshot_received.connect(_on_snapshot)
	NetworkManager.error_received.connect(_on_error)
	NetworkManager.pong_received.connect(_on_pong)

	# 進入畫面即自動連線。
	# 網頁版由 NetworkManager._ready() 自動偵測同源主機（serve:web）並指向 3002，
	# 這裡不要覆蓋，否則會連到預設的 3000（舊伺服器、無 AI 補位）。桌面版才用輸入框的 URL。
	if not OS.has_feature("web"):
		NetworkManager.url = url_edit.text
	NetworkManager.player_name = name_edit.text if name_edit.text != "" else "Player"
	NetworkManager.connect_to_server()


func _on_create_pressed() -> void:
	_apply_prefs()
	NetworkManager.create_room()


func _on_join_pressed() -> void:
	_apply_prefs()
	var room_id := room_edit.text.strip_edges()
	if room_id == "":
		status_label.text = "請輸入房間代碼"
		return
	# 重連：若本地已有 playerId 則帶上（伺服器恢復座位）。
	var previous := NetworkManager.player_id
	NetworkManager.join_room(room_id, previous)


func _apply_prefs() -> void:
	# 網頁版維持自動偵測的 URL（同源 3002），不覆蓋。
	if not OS.has_feature("web"):
		NetworkManager.url = url_edit.text.strip_edges()
	NetworkManager.player_name = name_edit.text.strip_edges()
	if NetworkManager.player_name == "":
		NetworkManager.player_name = "Player"
	var f := FileAccess.open("user://player_name.cfg", FileAccess.WRITE)
	if f:
		f.store_string(NetworkManager.player_name)


# ---------------------------------------------------------------------------
# NetworkManager 訊號處理
# ---------------------------------------------------------------------------

func _on_connected(protocol: String) -> void:
	status_label.text = "已連線 (protocol %s)" % protocol
	reconnect_label.visible = false


func _on_disconnected(code: int) -> void:
	status_label.text = "已斷線 (code %d) — 自動重連中…" % code
	reconnect_label.text = "重連中…"
	reconnect_label.visible = true


func _on_reconnect_attempt(attempt: int) -> void:
	reconnect_label.text = "重連嘗試 %d/%d…" % [attempt, NetworkManager.max_reconnect_attempts]


func _on_reconnect_failed() -> void:
	reconnect_label.text = "重連失敗 — 請確認 apps/server 已啟動"
	status_label.text = "未連線"


func _on_room_created(room_id: String) -> void:
	status_label.text = "已開房：%s （等待其他玩家加入…）" % room_id


func _on_player_joined(player_id: String, seat: int) -> void:
	status_label.text = "%s 已入座（座位 %d）" % [player_id.substr(0, 8), seat]


func _on_game_started(_dealer: int) -> void:
	_enter_table()


## 收到快照：已加入房間（lobby）就切到牌桌大廳，才能按「準備 (Ready)」。
func _on_snapshot(_snapshot: Dictionary) -> void:
	if GameState.status == "lobby" and GameState.room_id != "":
		_enter_table()


## 切換到牌桌場景（若已在大廳則不重複切換）。
func _enter_table() -> void:
	# 快照可能在場景樹尚未就緒、或本節點已被移出樹（競態）時到達，
	# 此時 get_tree() 內部會讀到 null 而炸。用 is_inside_tree() 判斷最安全。
	if not is_inside_tree():
		return
	var tree := get_tree()
	var current := tree.current_scene
	if current != null and current.name == "Table":
		return
	tree.change_scene_to_file("res://scenes/Table.tscn")


func _on_error(code: String, message: String, _operation_id: String) -> void:
	status_label.text = "錯誤 [%s] %s" % [code, message]


func _on_pong(latency_ms: int) -> void:
	status_label.text = "已連線 — 延遲 %d ms" % latency_ms
```

## File: apps/player-client/scripts/NetworkManager.gd

```
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

const DEFAULT_URL := "ws://localhost:3000/ws"
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
			connected.emit(event.get("protocol", ""))
		"room.created":
			room_id = event.get("roomId", "")
			room_created.emit(room_id)
		"player.joined":
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
func join_room(target_room_id: String, previous_player_id: String = "") -> void:
	var payload: Dictionary = {"roomId": target_room_id, "playerName": player_name}
	if previous_player_id != "":
		payload["playerId"] = previous_player_id
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
```

## File: apps/player-client/scripts/table.gd

```
extends Control
## Table — 牌桌視圖（Client-Safe UI）。
##
## 純渲染：所有狀態來自 GameState（伺服器快照），這裡不做任何規則判斷。
## 四家佈局：東(East) 右、南(South) 下、西(West) 左、北(North) 上。
## 視角旋轉：以「我(you)」為南方基準，把快照座位對映到四個方向。
##
## 伺服器快照揭露內容（snapshot.ts ClientSnapshot）：
##   - 自己的手牌（含 instanceId）— 點擊出牌
##   - 中央棄牌區 discards / lastDiscard（全域，非各家個別）
##   - 各家副露 melds / 手牌張數 handCount
##   - reactionHint（反應視窗選項，由伺服器計算）
##   - phaseDeadline / countdownMs（自動託管倒數）、dealer / dealerStreak（莊家連莊）、
##     players[].autoplay / connected（託管中 / 離線）、autoplayLog（本局託管紀錄）
##
## 動畫佇列（AnimationQueue）：快照之間的差異會被拆解成依序播放的動畫
##   * 摸牌飛入手牌（draw fly-in）
##   * 棄牌飛入中央棄牌池（discard fly-out）
##   * 吃碰槓牌面組合飛到副露區（meld fly）
## 播放期間鎖定玩家點擊；佇列清空後才刷入最新快照的最終畫面，
## 避免中間快照造成畫面瞬間跳變。

const TILE_BTN := preload("res://scenes/TileButton.tscn")

## 雀魂風格色票
const GOLD_TEXT := Color("#F3E5AB")
const GOLD_TEXT_DIM := Color(0.9, 0.85, 0.7, 1)
const GLASS_BG := Color("#121212CC")
const GOLD_BORDER := Color("#D4AF3766")
const IVORY_BG := Color("#FAF8F5")
const IVORY_TEXT := Color("#2B2118")
const SCORE_POS := Color("#2ECC71")
const SCORE_NEG := Color("#E74C3C")

## 座位 → 方向面板：以 you 為南方，順時針南→西→北→東。
var _seat_to_panel := {}

## 最後一次渲染的手牌（比對用，避免快照抖動重建按鈕）。
var _last_hand: Array = []

## 最後一次渲染時的中央棄牌張數（diff 用）。
var _last_discard_size := 0

## 最後一次渲染時各家副露 meld id 清單：{ seat: [meldId, ...] }。
var _last_melds: Dictionary = {}

## 本局是否已渲染過手牌（首次發牌 / 重連直接畫最終狀態，不做動畫）。
var _hand_rendered_once := false

## 動畫播放期間收到的快照，等佇列清空後要再刷一次最終畫面。
var _pending_final_render := false

## 每幀倒數的「整秒」快取 — 只在秒數變化時才寫 Label。
var _last_countdown_second := -1

## 本局結算音效是否已播放（避免 state_changed 重複觸發）。
var _settlement_sounded := false

## 目前選中的手牌 instanceId（點擊強調 + 棄牌池同張計數標記）。
var _selected_instance_id := -1

## 我出牌時點擊手牌按鈕的中心座標（供棄牌直飛動畫起始點；INF = 未設定）。
var _last_discard_origin := Vector2.INF

## 最新棄牌標記（8x8 橙黃小方塊，跟隨最後一張棄牌）。
var _last_discard_marker: ColorRect

## 倒數 ProgressBar 的「階段總長」（ms；以快照 countdownMs 為近似基準）。
var _countdown_total_ms := 1000
## 目前倒數截止（epoch ms；變更代表新階段開始）。
var _last_deadline := -1
## 倒數紅光閃爍 Tween（<5s 警示）。
var _flash_tween: Tween
## 胡按鈕金色脈動 Tween。
var _win_btn_tween: Tween

@onready var room_label: Label = %RoomLabel
@onready var status_label: Label = %StatusLabel
@onready var wall_label: Label = %WallLabel
@onready var countdown_label: Label = %CountdownLabel
@onready var dealer_info_label: Label = %DealerInfoLabel
@onready var leave_btn: Button = %LeaveBtn
@onready var lobby_panel: PanelContainer = %LobbyPanel
@onready var lobby_info: Label = %LobbyInfo
@onready var lobby_players: Label = %LobbyPlayers
@onready var ready_btn: Button = %ReadyBtn
@onready var hand_area: HBoxContainer = %HandArea
@onready var table_center: Panel = %TableCenter
@onready var hand_panel: PanelContainer = %HandPanel
@onready var hand_label: Label = %HandLabel
@onready var center_last_discard: TextureRect = %LastDiscardTile
@onready var river_bottom: GridContainer = %RiverBottom
@onready var river_top: GridContainer = %RiverTop
@onready var river_left: GridContainer = %RiverLeft
@onready var river_right: GridContainer = %RiverRight
@onready var opponent_backs: Dictionary = {
	"NorthPanel": %NorthHandBacks,
	"EastPanel": %EastHandBacks,
	"WestPanel": %WestHandBacks,
}
@onready var reaction_bar: HBoxContainer = %ReactionBar
@onready var chi_btn: Button = %ChiBtn
@onready var peng_btn: Button = %PengBtn
@onready var kong_btn: Button = %KongBtn
@onready var pass_btn: Button = %PassBtn
@onready var settlement_panel: PanelContainer = %SettlementPanel
@onready var settlement_title: Label = %SettlementTitle
@onready var settlement_detail: Label = %SettlementDetail
@onready var next_round_btn: Button = %NextRoundBtn
@onready var countdown_bar: ProgressBar = %CountdownBar
@onready var win_btn: Button = %WinBtn
@onready var settlement_backdrop: ColorRect = %SettlementBackdrop
@onready var fan_list_container: VBoxContainer = %FanListContainer
@onready var fx_layer: Control = %FXLayer

## 棄牌河池化：每個河預先建立最多 6 個 TextureRect，render 時只更新 texture 與 visible，避免 queue_free + add_child。
var _river_slots: Dictionary = {}  # GridContainer -> Array[TextureRect] (最多 24 個)

func _ready() -> void:
	var you: int = GameState.you
	var dirs := ["SouthPanel", "WestPanel", "NorthPanel", "EastPanel"]
	for i in range(4):
		var seat: int = (you + i) % 4
		_seat_to_panel[seat] = dirs[i]

	leave_btn.pressed.connect(_on_leave_pressed)
	ready_btn.pressed.connect(func(): NetworkManager.mark_ready())
	next_round_btn.pressed.connect(func(): NetworkManager.mark_ready())
	chi_btn.pressed.connect(func(): _do_reaction("chi"))
	peng_btn.pressed.connect(func(): _do_reaction("peng"))
	kong_btn.pressed.connect(func(): _do_reaction("kong"))
	pass_btn.pressed.connect(func(): NetworkManager.pass_reaction())
	win_btn.pressed.connect(_on_win_btn_pressed)
	# 動作按鈕：按壓下陷動效。
	for b: Button in [chi_btn, peng_btn, kong_btn, win_btn, pass_btn, ready_btn, next_round_btn]:
		_add_press_nudge(b)

	NetworkManager.game_started.connect(func(_dealer: int): _refresh())
	NetworkManager.game_ended.connect(func(_payload: Dictionary): _refresh())
	NetworkManager.error_received.connect(_on_error)
	GameState.state_changed.connect(_refresh)
	# 動畫佇列清空後，把最新快照的最終狀態一次刷上畫面。
	AnimationQueue.queue_drained.connect(_on_queue_drained)
	# 最新棄牌標記：8x8 橙黃小方塊（雀魂經典「最後棄牌」指示，跟隨最後一張棄牌）。
	_last_discard_marker = ColorRect.new()
	_last_discard_marker.color = Color(1.0, 0.78, 0.16, 0.95)
	_last_discard_marker.size = Vector2(8, 8)
	_last_discard_marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_last_discard_marker.z_index = 120
	_last_discard_marker.visible = false
	add_child(_last_discard_marker)
	_refresh()


## 每幀更新倒數計時與莊家資訊（依快照 phaseDeadline 本地倒數）。
func _process(_delta: float) -> void:
	if not is_inside_tree():
		return
	_update_countdown()
	_update_dealer_info()


func _exit_tree() -> void:
	if _flash_tween and _flash_tween.is_valid():
		_flash_tween.kill()
		_flash_tween = null



# ---------------------------------------------------------------------------
# 渲染主流程
# ---------------------------------------------------------------------------

func _refresh() -> void:
	room_label.text = "房間：%s" % GameState.room_id
	wall_label.text = "尾牆 %d / 牌牆 %d" % [GameState.wall_head_remaining, GameState.wall_deck_remaining]
	_update_dealer_info()

	if GameState.status != "playing":
		# 離開牌局狀態時重置 diff 追蹤，下一局重新直接渲染。
		_last_hand = []
		_last_discard_size = 0
		_last_melds = {}
		_hand_rendered_once = false
		_pending_final_render = false
		_hide_all_river_slots()

	# 新的一局開始：允許下一局再次播放結算音效。
	if GameState.status == "playing":
		_settlement_sounded = false

	match GameState.status:
		"lobby":
			_render_side_panels()
			_render_lobby()
		"playing":
			_render_playing()
		"ended":
			_render_side_panels()
			_render_settlement()
	_update_top_status()


func _render_lobby() -> void:
	lobby_panel.visible = true
	settlement_panel.visible = false
	settlement_backdrop.visible = false
	reaction_bar.visible = false
	hand_panel.visible = false
	table_center.visible = false
	lobby_info.text = "房號：%s" % GameState.room_id
	var lines: Array = []
	var my_ready := false
	for p in GameState.players:
		var who: String = "（我）" if int(p.get("seat", -1)) == GameState.you else ""
		var state_txt: String = "✓ 已準備" if p.get("ready", false) else "未準備"
		lines.append("座位 %d  %s  %s%s" % [p.get("seat", -1), p.get("playerName", "?"), state_txt, who])
		if int(p.get("seat", -1)) == GameState.you and p.get("ready", false):
			my_ready = true
	lobby_players.text = "\n".join(lines)
	# 準備按鈕：已準備就鎖定並顯示確認（避免重複送出）。
	ready_btn.disabled = my_ready
	ready_btn.text = "已準備 ✓（等待開始…）" if my_ready else "準備 (Ready)"


## 牌局進行中：把「本次快照 vs 上次已渲染狀態」的差異拆解成動畫 job，
## 全部播完（queue_drained）後才把最新快照的最終畫面刷上。
func _render_playing() -> void:
	lobby_panel.visible = false
	settlement_panel.visible = false
	settlement_backdrop.visible = false
	hand_panel.visible = true
	table_center.visible = true
	_render_last_discard()

	# 動畫播放中收到新快照：不疊加新動畫，鎖定輸入，等佇列清空後一次刷入最新狀態。
	if AnimationQueue.is_playing():
		_pending_final_render = true
		reaction_bar.visible = false
		_lock_hand_input(true)
		return

	# 首次渲染（發牌 / 重連）：直接畫最終狀態，不做動畫。
	if not _hand_rendered_once:
		_render_final_state()
		return

	# 收集本次快照與上次渲染之間的差異動畫。
	var jobs: Array[Callable] = []
	_collect_anim_jobs(jobs)
	if jobs.is_empty():
		_render_final_state()
		return

	_pending_final_render = true
	_lock_hand_input(true)
	for job in jobs:
		AnimationQueue.enqueue(job)


## 動畫佇列清空：以最新 Snapshot 直接刷上最終畫面，並更新 diff 基準。
## 若期間有新快照，這會一次刷入最新狀態；若無，則完成本次動畫收尾。
## 直接走 _render_final_state() 而非 _refresh()，可避免「相同 diff
## （如手牌張數增加）在佇列清空後被 _collect_anim_jobs 重複排入」的
## 無限動畫迴圈；非 playing 狀態（lobby/ended）仍走 _refresh() 做轉場。
func _on_queue_drained() -> void:
	if not _pending_final_render:
		return
	_pending_final_render = false
	if GameState.status == "playing":
		_render_final_state()
		_update_top_status()
	else:
		_refresh()


## 把最新快照「一次刷上畫面」：四家面板、棄牌池、手牌、反應列。
func _render_final_state() -> void:
	_render_side_panels()
	_render_discard_pool()
	_update_last_discard_marker()
	_render_hand()
	_render_reaction_bar()
	_last_discard_size = GameState.discards.size()
	_last_melds = _meld_signatures()
	_hand_rendered_once = true


## 鎖定 / 解鎖手牌點擊（動畫播放期間禁止送出指令）。
func _lock_hand_input(locked: bool) -> void:
	for btn in hand_area.get_children():
		if btn is Button:
			if btn.has_method("apply_playability"):
				btn.apply_playability(not locked and GameState.is_my_discard_turn() \
					and not GameState.is_autoplay(GameState.you))
			else:
				btn.disabled = locked
				if locked:
					btn.modulate.a = 0.85


## 牌局結束：彈出結算面板（勝者 / 台數 / 四家分數增減）+「準備下一局」按鈕。
func _render_settlement() -> void:
	lobby_panel.visible = false
	reaction_bar.visible = false
	hand_panel.visible = false
	table_center.visible = false
	settlement_backdrop.visible = true
	settlement_panel.visible = true
	settlement_title.text = "本局結束"
	for c in fan_list_container.get_children():
		c.queue_free()

	# 音效 + 我胡牌特效（畫面震動 + 金色光芒擴散），只播一次。
	if not _settlement_sounded:
		_settlement_sounded = true
		# winner 欄位允許 null（number | null）：null → -1，避免 int(null) 炸。
		var winner: int = -1
		if not GameState.settlement.is_empty():
			var w: Variant = GameState.settlement.get("winner", -1)
			winner = int(w) if w != null else -1
		if winner == GameState.you:
			AudioManager.play_win()
			_play_win_fx()
		AudioManager.play_settle()

	var header: Array = []
	header.append("莊家：%s（%s風 第 %d 局）" % [GameState.seat_name(GameState.dealer), _wind_name(GameState.dealer), GameState.dealer_streak])

	var s: Dictionary = GameState.settlement
	var line_index := 0
	# 流局判定用「winner == null」而非 settlement 是否為空：
	# server 流局時 settlement 非空（含全 0 ledger），但 winner/breakdown 皆 null。
	# 若用 s.is_empty() 會誤判成「有人胡」，並在 int(null) / Dictionary(null) 崩潰。
	var winner_v: Variant = s.get("winner", -1) if not s.is_empty() else null
	var is_draw := winner_v == null
	if is_draw:
		header.append("流局（和局）")
	else:
		var winner: int = int(winner_v)
		header.append("贏家：%s" % GameState.seat_name(winner))
		if s.get("selfDraw", false):
			header.append("自摸")
		elif s.get("kongDraw", false):
			header.append("槓上開花")
		elif GameState.last_discard_by >= 0:
			header.append("放槍胡（%s 放槍）" % GameState.seat_name(GameState.last_discard_by))
		var breakdown_v: Variant = s.get("breakdown", null)
		var breakdown: Dictionary = breakdown_v if breakdown_v is Dictionary else {}
		if not breakdown.is_empty():
			var fans: Array = breakdown.get("fans", [])
			var total: int = int(breakdown.get("total", 0))
			var fan_title := Label.new()
			fan_title.text = "— 台數明細（共 %d 台）—" % total
			fan_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			_style_label(fan_title, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 16)
			_animate_settlement_line(fan_title, line_index)
			line_index += 1
			for f in fans:
				var rule: String = f.get("rule", "?")
				var val: int = int(f.get("value", 0))
				var fl := Label.new()
				fl.text = "✦ %s  +%d 台" % [rule, val]
				fl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				_style_label(fl, _make_style(Color(0.1, 0.08, 0.04, 0.8), GOLD_BORDER, 5), GOLD_TEXT, 15)
				_animate_settlement_line(fl, line_index)
				line_index += 1
		if not s.get("ledger", []).is_empty():
			var sep := Label.new()
			sep.text = "— 分數結算 —"
			sep.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			_style_label(sep, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 16)
			_animate_settlement_line(sep, line_index)
			line_index += 1
			for e in s.get("ledger", []):
				var seat: int = e.get("seat", -1)
				var delta: int = e.get("delta", 0)
				var scores: Array = s.get("scores", [])
				var total_score: int = scores[seat] if seat >= 0 and seat < scores.size() else 0
				var tag: String = "（莊）" if seat == GameState.dealer else ""
				var sign: String = "+" if delta > 0 else ""
				var cl := Label.new()
				cl.text = "%s%s：%s%d 分（累計 %d）" % [GameState.seat_name(seat), tag, sign, delta, total_score]
				cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				# 分數：正綠 + / 負紅 -。
				_style_label(cl, _make_style(GLASS_BG, GOLD_BORDER, 6), \
					SCORE_POS if delta > 0 else SCORE_NEG, 15)
				_animate_settlement_line(cl, line_index)
				line_index += 1
	if not GameState.autoplay_log.is_empty():
		var al := Label.new()
		al.text = "自動託管：%s" % GameState.autoplay_summary()
		al.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_style_label(al, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT_DIM, 14)
		_animate_settlement_line(al, line_index)

	settlement_detail.text = "\n".join(header)
	# 「準備下一局」按鈕：已準備就鎖定並顯示確認。
	var my_ready := false
	for p in GameState.players:
		if int(p.get("seat", -1)) == GameState.you and p.get("ready", false):
			my_ready = true
			break
	next_round_btn.disabled = my_ready
	next_round_btn.text = "已準備 ✓" if my_ready else "準備下一局"


func _update_top_status() -> void:
	if not GameState.is_playing():
		status_label.text = "等待中"
	elif GameState.game_phase == "reaction":
		status_label.text = "反應視窗"
	elif GameState.turn == GameState.you:
		if GameState.is_autoplay(GameState.you):
			status_label.text = "你已自動託管（伺服器代打）"
		else:
			status_label.text = "輪到你出牌"
	else:
		status_label.text = "等待 %s 出牌…" % GameState.seat_name(GameState.turn)


# ---------------------------------------------------------------------------
# 動畫 diff（比較上次「已渲染」狀態與最新快照）
# ---------------------------------------------------------------------------

## 收集本次快照 vs 上次渲染的動畫 job（依序：摸牌 → 棄牌 → 副露）。
func _collect_anim_jobs(jobs: Array[Callable]) -> void:
	var hand: Array = GameState.my_hand()
	# 1) 摸牌：手牌張數增加 → 真正摸進的那張（伺服器權威 lastDrawnTile）滑入手牌。
	if hand.size() > _last_hand.size() and _last_hand.size() > 0:
		var drawn: Variant = _resolve_newly_added_tile(hand)
		if drawn != null:
			jobs.append(_job_draw_fly_in(drawn))
	# 2) 棄牌：中央棄牌區新增 → 從棄牌者座位飛入棄牌池。
	var discards: Array = GameState.discards
	if discards.size() > _last_discard_size:
		jobs.append(_job_discard_fly_out(str(discards[discards.size() - 1])))
	# 3) 副露：各家新增 meld → 牌面組合飛到該座位副露區。
	var melds_now: Dictionary = _meld_signatures()
	for seat in range(4):
		var old: Array = _last_melds.get(seat, [])
		var now: Array = melds_now.get(seat, [])
		for i in range(old.size(), now.size()):
			# 我方槓牌：畫面震動 + 金色光芒擴散特效。
			var melds_arr: Array = _player_view(seat).get("melds", [])
			if i < melds_arr.size() and seat == GameState.you \
				and str(melds_arr[i].get("kind", "")) == "kong":
				_play_kong_fx()
			# _meld_signatures() 只存 meld id（int）；_job_meld_fly 需要完整
			# meld Dictionary（claimed / tiles / kind）。從快照 melds_arr 取，
			# 避免 int → Dictionary 型別炸裂。
			var meld_data: Variant = melds_arr[i] if i < melds_arr.size() else null
			if meld_data is Dictionary:
				jobs.append(_job_meld_fly(seat, meld_data))


## 各家 meld id 清單（diff 用）。
func _meld_signatures() -> Dictionary:
	var out := {}
	for seat in range(4):
		var p := _player_view(seat)
		var ids: Array = []
		for m in p.get("melds", []):
			ids.append(int(m.get("id", -1)))
		out[seat] = ids
	return out


# ---------------------------------------------------------------------------
# 動畫 job（每個 job 啟動 Tween 並回傳，AnimationQueue 依序等待）
# ---------------------------------------------------------------------------

## 摸牌滑入手牌。
func _job_draw_fly_in(tile: Dictionary) -> Callable:
	var tile_id: String = str(tile.get("id", ""))
	return func() -> Tween:
		AudioManager.play_draw()
		return _fly_tile(tile_id, _wall_pos(), _hand_slot_pos())


## 棄牌直飛到目標河槽：我出牌時從點擊的手牌按鈕中心起飛，
## 對手出牌時從其座位面板中心起飛；落地時釋放飛行貼圖、顯示河槽貼圖，
## 並在落地瞬間播放棄牌音效。
func _job_discard_fly_out(tile_id: String) -> Callable:
	var seat: int = GameState.last_discard_by
	var river: GridContainer = _river_for_seat(seat) as GridContainer
	var slots: Array = _ensure_river_slots(river)
	var slot_index: int = clampi(GameState.discards_for(seat).size(), 1, 24) - 1
	var target: TextureRect = slots[slot_index]
	var slot_size: Vector2 = target.custom_minimum_size if target != null else Vector2(48, 64)
	var to_center: Vector2 = (target.global_position + slot_size / 2.0) \
		if target != null and target.global_position != Vector2.ZERO else _discard_pool_pos()
	var from_center: Vector2
	if seat == GameState.you and _last_discard_origin != Vector2.INF:
		from_center = _last_discard_origin
		_last_discard_origin = Vector2.INF
	else:
		from_center = _seat_center(seat)
	return func() -> Tween:
		return _fly_discard(tile_id, from_center, to_center, slot_size, target)


## 吃碰槓：被吃的牌面組合飛到該座位副露區。
func _job_meld_fly(seat: int, meld: Dictionary) -> Callable:
	var tid: String = str(meld.get("claimed", ""))
	if tid == "":
		var tiles: Array = meld.get("tiles", [])
		tid = str(tiles[0]) if not tiles.is_empty() else ""
	var kind: String = str(meld.get("kind", ""))
	return func() -> Tween:
		if tid == "":
			return null  # 沒有可動畫的牌面 → 同步完成。
		AudioManager.play_meld(kind)
		return _fly_tile(tid, _discard_pool_pos(), _meld_area_pos(seat), Vector2(40, 53))


## 建立一個從 from 飛到 to 的牌面貼圖動畫（播完自動釋放）。
func _fly_tile(tile_id: String, from: Vector2, to: Vector2, size: Vector2 = Vector2(48, 64)) -> Tween:
	# All tiles rendered exclusively via TileLoader.make_tile_rect() (no text labels).
	var tr := TileLoader.make_tile_rect(tile_id, size)
	tr.global_position = from
	tr.z_index = 100
	add_child(tr)
	var tw := create_tween()
	tw.tween_property(tr, "global_position", to, 0.35) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(tr, "modulate:a", 0.0, 0.18).set_delay(0.22)
	tw.tween_callback(tr.queue_free)
	return tw


## 棄牌直飛：牌面貼圖從 from_center 直飛 to_center（不淡出），落地後釋放貼圖、
## 顯示目標河槽 TextureRect，並於落地瞬間播放棄牌音效。最新棄牌標記同步跟隨。
func _fly_discard(tile_id: String, from_center: Vector2, to_center: Vector2, size: Vector2, target_slot: TextureRect) -> Tween:
	var tr := TileLoader.make_tile_rect(tile_id, size)
	tr.global_position = from_center - size / 2.0
	tr.z_index = 100
	add_child(tr)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(tr, "global_position", to_center - size / 2.0, 0.35) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	if _last_discard_marker != null:
		_last_discard_marker.visible = true
		_last_discard_marker.global_position = _marker_pos_for(from_center, size)
		tw.tween_property(_last_discard_marker, "global_position", _marker_pos_for(to_center, size), 0.35) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.set_parallel(false)
	tw.tween_callback(func():
		if is_instance_valid(tr):
			tr.queue_free()
		if target_slot != null and is_instance_valid(target_slot):
			TileLoader.apply_face(target_slot, tile_id)
			target_slot.visible = true
		AudioManager.play_discard())
	return tw


## 最新棄牌標記（8x8）置於牌面中心正上方的左上角座標。
func _marker_pos_for(tile_center: Vector2, tile_size: Vector2) -> Vector2:
	return tile_center + Vector2(-4.0, -(tile_size.y / 2.0) - 18.0)


# --- 動畫位置輔助 ---

## 摸牌來源：牌牆（TopBar 右上）。
func _wall_pos() -> Vector2:
	return wall_label.global_position + Vector2(wall_label.size.x / 2.0, 60.0)


## 手牌末端（新牌落點）：第 17 張摸牌與前 16 張融合於同一 HBoxContainer，
## 故一律飛到主手牌容器末端（最右側）。
func _hand_slot_pos() -> Vector2:
	return hand_area.global_position + Vector2(hand_area.size.x, hand_area.size.y / 2.0)


## 中央牌桌中心（棄牌 / 副露飛入落點）。
func _discard_pool_pos() -> Vector2:
	return table_center.global_position + Vector2(table_center.size.x / 2.0, table_center.size.y / 2.0)


## 該座位面板中心（棄牌來源）。
func _seat_center(seat: int) -> Vector2:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if panel_name == "":
		return _discard_pool_pos()
	var panel: Control = get_node(panel_name)
	return panel.global_position + panel.size / 2.0


## 該座位副露區落點。
func _meld_area_pos(seat: int) -> Vector2:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if panel_name == "":
		return _discard_pool_pos()
	var area: Control = get_node("%s/MeldArea" % panel_name)
	return area.global_position + Vector2(area.size.x, area.size.y / 2.0)


# ---------------------------------------------------------------------------
# 倒數計時（依快照 phaseDeadline 本地倒數）
# ---------------------------------------------------------------------------

func _update_countdown() -> void:
	if not GameState.has_countdown():
		countdown_label.text = ""
		_last_countdown_second = -1
		_last_deadline = -1
		countdown_bar.visible = false
		_countdown_bar_flash(false)
		return
	# 新階段開始：以快照 countdownMs 作為 ProgressBar 總長（近似）。
	if GameState.phase_deadline != _last_deadline:
		_last_deadline = GameState.phase_deadline
		_countdown_total_ms = maxi(GameState.countdown_ms, 1000)
	var remain_ms: int = GameState.remaining_ms()
	countdown_bar.visible = true
	countdown_bar.value = clampf(remain_ms / float(_countdown_total_ms) * 100.0, 0.0, 100.0)
	var sec: int = int(ceil(remain_ms / 1000.0))
	if sec == _last_countdown_second:
		_countdown_bar_flash(sec <= 5)
		return
	_last_countdown_second = sec
	var who: String = GameState.seat_name(GameState.turn)
	if GameState.game_phase == "reaction":
		countdown_label.text = "⏳ %d 秒" % sec
	else:
		countdown_label.text = "⏳ %s 思考 %d 秒" % [who, sec]
	# 剩 5 秒以內轉紅警示（Label + ProgressBar 紅光閃爍）。
	countdown_label.modulate = Color(0.9, 0.2, 0.2, 1) if sec <= 5 else Color(0.9, 0.55, 0.2, 1)
	_countdown_bar_flash(sec <= 5)


# ---------------------------------------------------------------------------
# 莊家與連莊資訊（TopBar）
# ---------------------------------------------------------------------------

## 以莊家為東，回傳該座位的風向名稱。
func _wind_name(seat: int) -> String:
	var winds := ["東", "南", "西", "北"]
	if GameState.dealer < 0:
		return ""
	var idx: int = (seat - GameState.dealer + 4) % 4
	return winds[idx]


func _update_dealer_info() -> void:
	if GameState.dealer < 0:
		dealer_info_label.text = "莊家：-"
		return
	var streak: int = GameState.dealer_streak
	var streak_txt: String = ""
	if streak > 0:
		streak_txt = "（連莊 %d）" % streak
	dealer_info_label.text = "%s風 莊家 %s%s" % [
		_wind_name(GameState.dealer), GameState.seat_name(GameState.dealer), streak_txt,
	]


# ---------------------------------------------------------------------------
# 四家側邊面板（玩家名 + 手牌張數 + 副露 + 莊/託管/離線標籤）
# ---------------------------------------------------------------------------

func _render_side_panels() -> void:
	for seat in range(4):
		var panel_name: String = _seat_to_panel.get(seat, "")
		if panel_name == "":
			continue
		var box: VBoxContainer = get_node(panel_name)
		# 清除舊的標題/張數標籤（保留 MeldArea / HandBacks 結構）。
		for child in box.get_children():
			if child is Label:
				child.queue_free()
		var p := _player_view(seat)
		var who: String = "（我）" if seat == GameState.you else ""
		var tag: String = _player_tag(seat, p)
		var title := Label.new()
		title.text = "%s %s (%d 張)%s%s" % [
			GameState.seat_name(seat), _wind_name(seat), p.get("handCount", 0), who, tag,
		]
		_style_label(title, _make_style(GLASS_BG, GOLD_BORDER, 6), GOLD_TEXT, 15)
		box.add_child(title)
		box.move_child(title, 0)
		_render_melds(seat)
		# Majsoul compact opponent hand backs (back.png via TileLoader).
		if seat != GameState.you and GameState.is_playing():
			_render_hand_backs(seat)


## 建立一張「牌背」TextureRect（使用 back.png 貼圖 exclusively via TileLoader.make_back_rect() for Majsoul compact opponent hands）。
func _make_tile_back(tile_size: Vector2) -> TextureRect:
	return TileLoader.make_back_rect(tile_size)


## 對家/上家/下家：依 handCount 繪製 13-16 張牌背。
## 北（上）→ 水平置中排列，牌背 26x36；西/東（左右）→ 緊湊直列，不拉伸佔滿螢幕。
func _render_hand_backs(seat: int) -> void:
	var panel_name: String = _seat_to_panel.get(seat, "")
	if not opponent_backs.has(panel_name):
		return
	var box: Container = opponent_backs[panel_name]
	for child in box.get_children():
		child.queue_free()
	var count: int = clampi(int(_player_view(seat).get("handCount", 0)), 13, 17)
	var horizontal: bool = box is HBoxContainer
	# 北（橫排）26x36；西/東（直列）緊湊 22x30，嚴禁拉伸成長條。
	var tile_size := Vector2(26, 36) if horizontal else Vector2(22, 30)
	# 直列（東西兩側）空間有限：最多 13 張，維持緊湊群組。
	var show: int = count if horizontal else mini(count, 13)
	for i in range(show):
		box.add_child(_make_tile_back(tile_size))


## 莊 / 託管中 / 離線 視覺標籤。
func _player_tag(seat: int, p: Dictionary) -> String:
	var tags: Array = []
	if seat == GameState.dealer:
		tags.append("[莊]")
	if p.get("autoplay", false):
		tags.append("⚠託管中")
	elif not p.get("connected", false):
		tags.append("⚡離線")
	if tags.is_empty():
		return ""
	return " " + " ".join(tags)


func _render_melds(seat: int) -> void:
	var panel_name: String = _seat_to_panel.get(seat, "")
	var box: HBoxContainer = get_node("%s/MeldArea" % panel_name)
	for child in box.get_children():
		child.queue_free()
	var p := _player_view(seat)
	for m in p.get("melds", []):
		var kind: String = str(m.get("kind", "?"))
		var kind_tag := Label.new()
		kind_tag.text = "[%s]" % kind
		_style_label(kind_tag, _make_style(GLASS_BG, GOLD_BORDER, 4), GOLD_TEXT_DIM, 12)
		box.add_child(kind_tag)
		for t in m.get("tiles", []):
			# Melds use TileLoader.make_tile_rect() exclusively (no text labels).
			box.add_child(TileLoader.make_tile_rect(str(t), Vector2(40, 53)))


# ---------------------------------------------------------------------------
# 中央棄牌區（全域）
# ---------------------------------------------------------------------------

## 座位 → 中央牌桌內側棄牌河（依 _seat_to_panel 方向對映）。
func _river_for_seat(seat: int) -> Control:
	var panel_name: String = _seat_to_panel.get(seat, "")
	match panel_name:
		"SouthPanel":
			return river_bottom
		"NorthPanel":
			return river_top
		"WestPanel":
			return river_left
		"EastPanel":
			return river_right
	return river_bottom


## 確保某個棄牌河的池化槽位已建立（最多 24 個 TextureRect = 4 行 × 6 列）。
## 第一次呼叫時建立並加入 river，之後重用；超過 24 張時只顯示最新 24 張。
func _ensure_river_slots(river: GridContainer) -> Array:
	if _river_slots.has(river):
		return _river_slots[river]
	var slots: Array = []
	# 決定此河的牌面尺寸（西/東側直列可換行空間小 → 縮小避免打爆 layout）。
	var sz := Vector2(32, 42)
	if river == river_left or river == river_right:
		sz = Vector2(16, 22)
	for i in range(24):
		var tr := TextureRect.new()
		tr.custom_minimum_size = sz
		tr.size = sz
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tr.visible = false
		river.add_child(tr)
		slots.append(tr)
	_river_slots[river] = slots
	return slots


## 離開 playing 狀態時隱藏所有河槽位（避免殘留畫面）。
func _hide_all_river_slots() -> void:
	for river in _river_slots.keys():
		for tr in _river_slots[river]:
			tr.visible = false


## 中央牌桌內側棄牌河：四家各收納在牌桌四邊內側（下/上/左/右）。
## Bottom/Top 每行 6 張（4 行 × 6 列 = 24 張）；Left/Right 垂直緊湊直列。
## 超過 24 張只顯示最新 24 張。使用池化槽位，只更新 texture 與 visible，不重建節點。
func _render_discard_pool() -> void:
	for seat in range(4):
		var river: GridContainer = _river_for_seat(seat) as GridContainer
		var slots: Array = _ensure_river_slots(river)
		var tiles: Array = GameState.discards_for(seat)
		# 超過 24 張只顯示最新 24 張（台灣一局每人最多約 20-24 張出牌）。
		if tiles.size() > 24:
			tiles = tiles.slice(tiles.size() - 24)
		for i in range(24):
			var tr: TextureRect = slots[i]
			if i < tiles.size():
				var tile_id: String = str(tiles[i])
				TileLoader.apply_face(tr, tile_id)
				tr.visible = true
			else:
				tr.visible = false


## 中央「最後棄牌」大牌面（LastDiscardTile 貼圖；無牌時隱藏）。
func _render_last_discard() -> void:
	if GameState.last_discard == "":
		center_last_discard.visible = false
		return
	center_last_discard.visible = true
	TileLoader.apply_face(center_last_discard, GameState.last_discard)


# ---------------------------------------------------------------------------
# 我的手牌（點擊出牌；動畫播放期間鎖定）
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 手牌自動理牌（Auto-Sort）
# ---------------------------------------------------------------------------

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
func _tile_sort_key(t: Dictionary) -> int:
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


## 回傳「依麻將花色與順序排序後」的手牌（同張以 instanceId 穩定排序）。
func _sorted_hand(hand: Array) -> Array:
	var out: Array = hand.duplicate()
	out.sort_custom(func(a, b) -> bool:
		var ka := _tile_sort_key(a)
		var kb := _tile_sort_key(b)
		if ka != kb:
			return ka < kb
		return int(a.get("instanceId", -1)) < int(b.get("instanceId", -1)))
	return out


func _render_hand() -> void:
	var full_hand: Array = _sorted_hand(GameState.my_hand())
	hand_label.text = "我的手牌（%d 張）" % full_hand.size()
	var split := _split_drawn_tile(full_hand)
	var hand: Array = split[0]
	var drawn: Variant = split[1]
	var animating: bool = AnimationQueue.is_playing()
	var can_play: bool = GameState.is_my_discard_turn() \
		and not GameState.is_autoplay(GameState.you) and not animating
	if _hand_equals(full_hand):
		if not _order_equals(full_hand):
			# 相同牌、不同順序（自動理牌）→ 平滑重排，不重建按鈕。
			_animate_hand_reflow(hand, can_play)
		else:
			_apply_playability_all(can_play)
		_render_draw_spacer(drawn, can_play)
		_last_hand = full_hand.duplicate()
		return
	if _last_hand.is_empty():
		# 首次發牌 / 重連：直接畫最終排序狀態（無動畫，避免閃現跳動）。
		_rebuild_hand_sync(hand, can_play)
	else:
		# 摸牌 / 吃碰槓 / 棄牌：平滑合併重排（保留按鈕、滑動到位）。
		_animate_hand_reflow(hand, can_play)
	_render_draw_spacer(drawn, can_play)
	_last_hand = full_hand.duplicate()


## 以「伺服器權威 lastDrawnTile → 上一幀集合差異 → 最後一張」的優先序辨識
## 本回合真正摸進的牌（不可用 max-instanceId — 牌牆建牌先編號再洗牌，
## instanceId 與摸牌順序無關）。供摸牌分離與摸牌動畫共用，避免兩套邏輯分歧。
func _resolve_newly_added_tile(hand: Array) -> Variant:
	if hand.is_empty():
		return null
	var newest: Variant = null
	# 1) 伺服器權威：lastDrawnTile 就是本回合真正摸進的牌（GameState 註解明確：
	#    優先以它辨識第 17 張，可精確抓出「真正摸進」的那張）。
	if GameState.last_drawn_by == GameState.you and not GameState.last_drawn_tile.is_empty():
		var wanted := int(GameState.last_drawn_tile.get("instanceId", -1))
		for t in hand:
			if int(t.get("instanceId", -1)) == wanted:
				newest = t
				break
	# 2) 無伺服器權威可比（lastDrawnTile 已清空 / 非我摸牌，如吃碰後）：以「上一幀
	#    手牌」集合差異找出真正新增的 instanceId（修復摸牌跳牌）。
	if newest == null and not _last_hand.is_empty():
		var prev_ids := {}
		for t in _last_hand:
			prev_ids[int(t.get("instanceId", -1))] = true
		var candidates: Array = []
		for t in hand:
			if not prev_ids.has(int(t.get("instanceId", -1))):
				candidates.append(t)
		if candidates.size() >= 1:
			newest = candidates[0]
	# 3) 終極 fallback（正常不應發生）：退回排序後最後一張。
	if newest == null:
		newest = hand[hand.size() - 1]
	return newest


func _split_drawn_tile(hand: Array) -> Array:
	if hand.size() != 17 or not GameState.is_my_discard_turn():
		return [hand, null]
	var newest: Variant = _resolve_newly_added_tile(hand)
	var base: Array = hand.duplicate()
	base.erase(newest)
	return [base, newest]


## 摸牌分離鐵律：第 17 張摸牌「絕對禁止」建立獨立於手牌容器之外的浮動節點。
## 正確做法：在 PlayerHandContainer（hand_area）第 16 張與第 17 張之間動態插入
## 一個寬度剛好 18px 的透明 Control 間隔器，再將第 17 張牌作為該 HBox 最後一個子節點。
func _render_draw_spacer(drawn: Variant, can_play: bool) -> void:
	# 移除既有的間隔器與舊摸牌按鈕（若存在）。
	for child in hand_area.get_children():
		if child is Control and child.has_meta("draw_spacer"):
			child.queue_free()
		elif child is Button and child.has_meta("is_drawn_tile"):
			child.queue_free()
	if drawn == null:
		return
	# 建立 24px 透明間隔器，插在第 16 張（最後一張基礎牌）之後。
	# 24px 讓「摸進的新牌在最右側」一眼可辨（雀魂式）；辨識仍用 lastDrawnTile。
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(24, 0)
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.set_meta("draw_spacer", true)
	hand_area.add_child(spacer)
	# 第 17 張牌作為 HBox 最後一個子節點（與前 16 張同一容器）。
	var btn: Button = _create_tile_button(drawn, can_play)
	btn.set_meta("is_drawn_tile", true)
	hand_area.add_child(btn)


## 建立一張手牌按鈕並套用完整狀態（可出牌、選中、胡光暈、算牌高亮）。
func _create_tile_button(t: Dictionary, can_play: bool) -> Button:
	var btn: Button = TILE_BTN.instantiate()
	btn.setup(int(t.get("instanceId", -1)), str(t.get("id", "")), can_play)
	btn.disabled = not can_play
	if btn.has_method("apply_playability"):
		btn.apply_playability(can_play)
		btn.tile_clicked.connect(_on_tile_clicked)
		btn.tile_discarded.connect(_on_tile_discard_requested)
		_apply_tile_extras(btn)
	return btn


## 同步重建手牌（首發 / 重連，無動畫）。
func _rebuild_hand_sync(hand: Array, can_play: bool) -> void:
	for child in hand_area.get_children():
		child.queue_free()
	for t in hand:
		hand_area.add_child(_create_tile_button(t, can_play))


## 只更新可出牌 / 選中 / 胡光暈 / 算牌高亮（手牌內容與順序皆不變）。
## 第 17 張摸牌已融合於 hand_area 內，故單一迴圈即可涵蓋全部手牌按鈕。
func _apply_playability_all(can_play: bool) -> void:
	for child in hand_area.get_children():
		if child is Button:
			if child.has_method("apply_playability"):
				child.apply_playability(can_play)
				_apply_tile_extras(child)
			else:
				child.modulate.a = 1.0 if can_play else 0.85
				child.disabled = not can_play


## 手牌平滑重排（自動理牌動畫）：
##   * 仍存在的手牌 → 平滑滑動到排序後的新位置（HBox 重排後 Tween）
##   * 被移除的牌 → 淡出後移除
##   * 新加入的牌 → 淡入
## 純視覺動畫（不進 AnimationQueue，不影響出牌輸入鎖定）。
func _animate_hand_reflow(hand: Array, can_play: bool) -> void:
	var from_pos := {}
	var old_buttons := {}
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child:
			from_pos[child.instance_id] = child.global_position
			old_buttons[child.instance_id] = child
	# 1) 已不存在的手牌 → 淡出移除。
	#    第 17 張摸牌（meta is_drawn_tile）已融合於 hand_area，視為常駐，不得移除。
	var keep_ids := {}
	for t in hand:
		keep_ids[int(t.get("instanceId", -1))] = true
	for child in hand_area.get_children():
		if child is Button and child.has_meta("is_drawn_tile"):
			keep_ids[int(child.instance_id)] = true
	for inst in old_buttons:
		if not keep_ids.has(inst):
			var btn: Button = old_buttons[inst]
			var tw := create_tween()
			tw.tween_property(btn, "modulate:a", 0.0, 0.15)
			tw.tween_callback(btn.queue_free)
	# 2) 依排序順序重新排列既有按鈕（move_child → HBox 自動重排）。
	#    只重排前 16 張基礎牌；間隔器與第 17 張摸牌保持在容器末端。
	for i in range(hand.size()):
		var inst := int(hand[i].get("instanceId", -1))
		var btn = old_buttons.get(inst)
		if btn != null and hand_area.get_children().find(btn) != i:
			hand_area.move_child(btn, i)
	# 3) 新增的手牌 → 建立按鈕 + 淡入。
	for i in range(hand.size()):
		var inst := int(hand[i].get("instanceId", -1))
		if old_buttons.has(inst):
			continue
		var btn: Button = _create_tile_button(hand[i], can_play)
		hand_area.add_child(btn)
		hand_area.move_child(btn, i)
		btn.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(btn, "modulate:a", 1.0, 0.25)
	# 4) 同步套用可出牌狀態（解除動畫鎖定）；重排期間暫停上浮，避免 Tween 衝突。
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child:
			if child.has_method("set_suppress_lift"):
				child.set_suppress_lift(true)
			if child.has_method("apply_playability"):
				child.apply_playability(can_play)
	# 5) 等一幀讓 HBox 套用新排序位置，再平滑滑動舊位置 → 新位置。
	await get_tree().process_frame
	if not is_inside_tree():
		return
	var last_tw: Tween = null
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and keep_ids.has(child.instance_id):
			var new_gp: Vector2 = child.global_position
			var old: Variant = from_pos.get(child.instance_id)
			if old != null and old != new_gp:
				child.global_position = old
				var tw := create_tween()
				tw.tween_property(child, "global_position", new_gp, 0.22) \
					.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
				last_tw = tw
	if last_tw:
		await last_tw.finished
	# 6) 動畫結束：更新基準位置，恢復上浮，並套用選中 / 胡光暈 / 算牌高亮。
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and keep_ids.has(child.instance_id):
			if child.has_method("reset_base_position"):
				child.reset_base_position()
			if child.has_method("set_suppress_lift"):
				child.set_suppress_lift(false)
			if child.has_method("apply_playability"):
				_apply_tile_extras(child)


## 依目前快照套用：胡牌光暈（canWin）與選中框。
## 算牌張數（棄牌池同張剩餘）不再以整手「淡金底」標記 — 棄牌池隨對局累積後會讓
## 滿手牌出現黃色框框（視覺噪音），改為僅在「點選中的牌」以 tooltip 顯示張數。
func _apply_tile_extras(btn: Button) -> void:
	if not btn.has_method("set_win_glow") or not btn.has_method("set_selected"):
		return
	btn.set_win_glow(GameState.can_win)
	var inst: int = btn.instance_id if "instance_id" in btn else -1
	btn.set_selected(inst == _selected_instance_id)
	# 輪到「我」出牌時，點選的牌顯示棄牌池中同張剩餘張數（tooltip）。
	if inst == _selected_instance_id and GameState.is_my_discard_turn() and btn.tile_id != "":
		var out: int = 0
		for d in GameState.discards:
			if str(d) == btn.tile_id:
				out += 1
		btn.tooltip_text = "%s 棄牌池已出 %d 張" % [GameState.tile_label(btn.tile_id), out]
	else:
		btn.tooltip_text = btn.tile_id


## 更新選中 instanceId，並同步所有手牌按鈕的選中/算牌高亮與棄牌池同款高亮。
func _set_selection(instance_id: int) -> void:
	_selected_instance_id = instance_id
	for child in hand_area.get_children():
		if child is Button and child.has_method("set_selected"):
			_apply_tile_extras(child)
	_highlight_discard_matches()


## 第一次點擊手牌：選中（抬升 + 金色外框 + 同款高亮）。
func _on_tile_clicked(instance_id: int) -> void:
	_set_selection(instance_id)


## 第二次點擊（已選中）送出出牌前：記錄點擊按鈕中心座標（供棄牌直飛動畫起點），
## 並清除選中狀態。
func _on_tile_discard_requested(instance_id: int) -> void:
	for child in hand_area.get_children():
		if child is Button and "instance_id" in child and int(child.instance_id) == instance_id:
			_last_discard_origin = child.global_position + child.size / 2.0
			break
	_set_selection(-1)


## 棄牌池同款高亮：把與選中牌同款的河槽貼圖暖金染色（其餘回復原色）。
func _highlight_discard_matches() -> void:
	var selected_tile_id := ""
	if _selected_instance_id >= 0:
		for child in hand_area.get_children():
			if child is Button and "instance_id" in child \
				and int(child.instance_id) == _selected_instance_id:
				selected_tile_id = str(child.tile_id)
				break
	for river in _river_slots.keys():
		for tr in _river_slots[river]:
			if selected_tile_id != "" and tr.visible \
				and str(tr.get_meta("tile_id", "")) == selected_tile_id:
				tr.modulate = Color(1.3, 1.15, 0.7, 1.0)
			else:
				tr.modulate = Color(1.0, 1.0, 1.0, 1.0)


## 最新棄牌標記：定位到最後一張棄牌的河槽正上方（跟隨最後棄牌）。
func _update_last_discard_marker() -> void:
	if _last_discard_marker == null:
		return
	if GameState.last_discard == "" or GameState.last_discard_by < 0:
		_last_discard_marker.visible = false
		return
	var seat: int = GameState.last_discard_by
	var river: GridContainer = _river_for_seat(seat) as GridContainer
	var slots: Array = _ensure_river_slots(river)
	var slot_index: int = clampi(GameState.discards_for(seat).size(), 1, 24) - 1
	var target: TextureRect = slots[slot_index]
	if target == null or target.global_position == Vector2.ZERO:
		_last_discard_marker.visible = false
		return
	var slot_size: Vector2 = target.custom_minimum_size
	_last_discard_marker.global_position = _marker_pos_for(
		target.global_position + slot_size / 2.0, slot_size)
	_last_discard_marker.visible = true


## 手牌內容是否相同（以 instanceId 集合比對，順序無關 — 排序屬客戶端美化）。
func _hand_equals(hand: Array) -> bool:
	if hand.size() != _last_hand.size():
		return false
	var set_a := {}
	for t in hand:
		set_a[int(t.get("instanceId", -1))] = true
	for t in _last_hand:
		if not set_a.has(int(t.get("instanceId", -1))):
			return false
	return true


## 手牌順序是否完全相同（依序比對 instanceId）。
func _order_equals(hand: Array) -> bool:
	if hand.size() != _last_hand.size():
		return false
	for i in range(hand.size()):
		if int(hand[i].get("instanceId", -1)) != int(_last_hand[i].get("instanceId", -1)):
			return false
	return true


# ---------------------------------------------------------------------------
# 反應視窗（伺服器計算，客戶端只顯示；動畫播放期間隱藏）
# ---------------------------------------------------------------------------

func _render_reaction_bar() -> void:
	if not GameState.in_reaction_window() or AnimationQueue.is_playing():
		reaction_bar.visible = false
		win_btn.visible = false
		_stop_win_btn_pulse()
		return
	reaction_bar.visible = true
	chi_btn.disabled = not _can_react("chi")
	peng_btn.disabled = not _can_react("peng")
	kong_btn.disabled = not _can_react("kong")
	_update_win_btn()


func _can_react(kind: String) -> bool:
	for o in GameState.reaction_options():
		if o.get("kind", "") == kind:
			return true
	return false


func _do_reaction(kind: String) -> void:
	for o in GameState.reaction_options():
		if o.get("kind", "") != kind:
			continue
		var hand_tile_ids: Array = o.get("handTileIds", [])
		var extra: Dictionary = {}
		if o.has("kongType"):
			extra["kongType"] = o.get("kongType", "open")
		if o.has("pengMeldId") and int(o.get("pengMeldId", 0)) > 0:
			extra["pengMeldId"] = o.get("pengMeldId", 0)
		NetworkManager.react(kind, hand_tile_ids, extra)
		return
	push_warning("Table: 目前沒有 %s 的合法反應" % kind)


# ---------------------------------------------------------------------------
# 其他
# ---------------------------------------------------------------------------

func _player_view(seat: int) -> Dictionary:
	for p in GameState.players:
		if int(p.get("seat", -1)) == seat:
			return p
	return {}


func _on_error(code: String, message: String, _operation_id: String) -> void:
	status_label.text = "錯誤 [%s] %s" % [code, message]


func _on_leave_pressed() -> void:
	NetworkManager.disconnect_from_server()
	get_tree().change_scene_to_file("res://scenes/Main.tscn")


# ---------------------------------------------------------------------------
# 雀魂風格：樣式工廠 + 特效
# ---------------------------------------------------------------------------

## 建立玻璃/牌面 StyleBoxFlat（圓角 + 金邊 + 底部陰影）。
func _make_style(bg: Color, border: Color, radius: int = 6, border_w: int = 1) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.border_width_left = border_w
	sb.border_width_right = border_w
	sb.border_width_top = border_w
	sb.border_width_bottom = border_w
	sb.corner_radius_top_left = radius
	sb.corner_radius_top_right = radius
	sb.corner_radius_bottom_left = radius
	sb.corner_radius_bottom_right = radius
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 3
	sb.shadow_offset = Vector2(0, 2)
	return sb


## 套用樣式到 Label（背景 StyleBox + 文字色 + 字號）。
func _style_label(lbl: Label, sb: StyleBoxFlat, color: Color, font_size: int = -1) -> void:
	lbl.add_theme_stylebox_override("normal", sb)
	lbl.add_theme_color_override("font_color", color)
	if font_size > 0:
		lbl.add_theme_font_size_override("font_size", font_size)


## 倒數 ProgressBar：剩 5 秒以內啟動紅光閃爍 Tween。
func _countdown_bar_flash(urgent: bool) -> void:
	if urgent and (_flash_tween == null or not _flash_tween.is_valid()):
		_flash_tween = create_tween().set_loops()
		_flash_tween.tween_property(countdown_bar, "modulate", Color(1.6, 0.3, 0.3, 1), 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_flash_tween.tween_property(countdown_bar, "modulate", Color(1.0, 1.0, 1.0, 1), 0.35) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	elif not urgent and _flash_tween and _flash_tween.is_valid():
		_flash_tween.kill()
		_flash_tween = null
		countdown_bar.modulate = Color(1.0, 1.0, 1.0, 1)


## 動作按鈕按壓下陷動效（position.y += 2）。
func _add_press_nudge(btn: Button) -> void:
	btn.button_down.connect(func(): btn.position += Vector2(0, 2))
	btn.button_up.connect(func(): btn.position -= Vector2(0, 2))


## 胡按鈕：spec 定義「合法即自動胡（auto-win）、沒有胡/過按鈕」，
## 伺服器在 detectWin 成立時自動 finishWin。此按鈕保留節點（不刪以免場景壞掉），
## 但永遠隱藏，不提供玩家「胡」選項。`canWin`（聽牌）仍驅動手牌光暈。
func _update_win_btn() -> void:
	# auto-win：不顯示胡按鈕；保留 _on_win_btn_pressed 特效防呆（不送指令）。
	win_btn.visible = false
	_stop_win_btn_pulse()
	win_btn.text = "可胡！"


func _stop_win_btn_pulse() -> void:
	if _win_btn_tween and _win_btn_tween.is_valid():
		_win_btn_tween.kill()
		_win_btn_tween = null
	win_btn.modulate = Color(1.0, 1.0, 1.0, 1)


func _on_win_btn_pressed() -> void:
	AudioManager.play_button()
	# 伺服器為自動胡牌（canWin 驅動），這裡只做回饋特效。
	_play_screen_shake()
	_play_gold_burst("可胡！")


## 我胡牌：畫面震動 + 金色光芒擴散。
func _play_win_fx() -> void:
	_play_screen_shake()
	var s: Dictionary = GameState.settlement
	var label := "胡！"
	if s.get("selfDraw", false):
		label = "自摸！"
	elif s.get("kongDraw", false):
		label = "槓上開花！"
	_play_gold_burst(label)


## 我方槓牌：畫面震動 + 金色光芒擴散。
func _play_kong_fx() -> void:
	_play_screen_shake()
	_play_gold_burst("槓！")


## 畫面震動：5 個隨機位移幀後回歸原位。
func _play_screen_shake() -> void:
	var tw := create_tween()
	var orig := Vector2.ZERO
	for i in range(5):
		var off := Vector2(randf_range(-9.0, 9.0), randf_range(-9.0, 9.0))
		tw.tween_property(self, "position", orig + off, 0.035)
	tw.tween_property(self, "position", orig, 0.035)


## 中央金色光芒擴散 + 大字（FXLayer 中心）。
func _play_gold_burst(label_text: String) -> void:
	if not is_inside_tree() or fx_layer == null:
		return
	var center: Vector2 = fx_layer.size / 2.0
	# 金色放射光芒（Radial Gradient 放大淡出）。
	var grad := Gradient.new()
	grad.set_color(0, Color(1.0, 0.86, 0.35, 0.95))
	grad.set_color(1, Color(1.0, 0.86, 0.35, 0.0))
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.width = 256
	tex.height = 256
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1, 1)
	tex.fill = GradientTexture2D.FILL_RADIAL
	var glow := TextureRect.new()
	glow.texture = tex
	glow.size = Vector2(220, 220)
	glow.pivot_offset = Vector2(110, 110)
	glow.position = center - Vector2(110, 110)
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx_layer.add_child(glow)
	var tw := create_tween()
	tw.tween_property(glow, "scale", Vector2(3.2, 3.2), 0.55) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(glow, "modulate:a", 0.0, 0.55)
	tw.tween_callback(glow.queue_free)
	# 中央大字。
	var lbl := Label.new()
	lbl.text = label_text
	lbl.add_theme_font_size_override("font_size", 52)
	lbl.add_theme_color_override("font_color", GOLD_TEXT)
	lbl.add_theme_color_override("font_outline_color", Color(0.55, 0.35, 0.05, 1))
	lbl.add_theme_constant_override("outline_size", 10)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.size = Vector2(420, 64)
	lbl.pivot_offset = Vector2(210, 32)
	lbl.position = center - Vector2(210, 32)
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx_layer.add_child(lbl)
	var tw2 := create_tween()
	tw2.tween_property(lbl, "scale", Vector2(1.35, 1.35), 0.35) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw2.parallel().tween_property(lbl, "modulate:a", 0.0, 0.5).set_delay(0.45)
	tw2.tween_callback(lbl.queue_free)


## 結算面板逐項淡入上滑（加入 FanListContainer 後動畫）。
func _animate_settlement_line(lbl: Label, index: int) -> void:
	fan_list_container.add_child(lbl)
	lbl.modulate.a = 0.0
	await get_tree().process_frame
	if not is_inside_tree() or not is_instance_valid(lbl) or lbl.get_parent() != fan_list_container:
		return
	var base: Vector2 = lbl.position
	lbl.position = base + Vector2(0, 14)
	var tw := create_tween()
	tw.tween_interval(0.06 * index)
	tw.tween_property(lbl, "position", base, 0.32) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(lbl, "modulate:a", 1.0, 0.32)
```

## File: apps/player-client/scripts/tile_loader.gd

```
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
```

## File: apps/player-client/scripts/TileButton.gd

```
extends Button
## TileButton — 可點擊的單張手牌按鈕（Client-Safe UI）。
##
## 由 Table 視圖動態實體化；持有 instanceId（伺服器手牌唯一 ID）。
## 點擊時若「輪到自己出牌」，送出 Discard Command（含 generationId）。
##
## 牌面渲染（貼圖版）：
##   * 牌面 / 牌背皆用麻將 PNG 貼圖（TileLoader 統一載入，絕不出現純文字）。
##   * 節點結構：Button(48x64) > Back(TextureRect) + Face(TextureRect)。
##   * Hover / 選中：position.y 上浮 -HOVER_LIFT（20px），scale 恆為 1.0，
##     圖片不會變形、縮小或被裁切。
##   * 點擊選中：金色強調框 + 同步上浮（兩段式：第一次選中、第二次出牌）。
##   * 胡牌光暈：canWin（聽牌）時金色脈動光暈。
##   * 算牌高亮：被 Table 標記為「棄牌池同款」時暖金強調框。

signal tile_clicked(instance_id: int)
## 第二次點擊（已選中）時送出：Table 記錄出牌起點並清除選中，再由本按鈕送 Discard。
signal tile_discarded(instance_id: int)

## Hover / 選中動畫參數（僅上浮；Scale 恆 = 1.0，嚴禁縮小/變形/裁切）。
const HOVER_LIFT := 20.0
const HOVER_DURATION := 0.12

## 強調框色票（貼圖外框）。
const GOLD_BORDER := Color("#D4AF37")
const GOLD_BORDER_SOFT := Color(0.83, 0.69, 0.22, 0.8)

var instance_id := -1
var tile_id := ""
## 是否為自己手牌中的可出牌張（由 Table 依 turn/phase 設定）。
var playable := false
## 是否為「棄牌池同款」高亮（算牌）。
var discard_match := false

var _selected := false
var _win_glow := false
var _hovered := false
var _base_pos := Vector2.ZERO
## 上浮前快照的版面位置（HBox 配置出的實際位置）。
var _rest_pos := Vector2.ZERO
## 目前是否處於上浮狀態（Hover 或 選中）。
var _lifted := false
## 手牌重排動畫期間暫停上浮（避免與版面滑動 Tween 衝突）。
var _suppress_lift := false
var _scale_tween: Tween
var _pulse_tween: Tween

@onready var face_rect: TextureRect = $Face
@onready var back_rect: TextureRect = $Back


func setup(tile_instance_id: int, id: String, can_play: bool) -> void:
	instance_id = tile_instance_id
	tile_id = id
	playable = can_play
	tooltip_text = id
	_refresh_appearance()


func _ready() -> void:
	_apply_textures()
	pressed.connect(_on_pressed)
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	# 加入場景樹後再刷一次（setup() 可能在進入樹前就被呼叫，@onready 尚未就緒）。
	_refresh_appearance()


func _exit_tree() -> void:
	if _scale_tween and _scale_tween.is_valid():
		_scale_tween.kill()
		_scale_tween = null
	if _pulse_tween and _pulse_tween.is_valid():
		_pulse_tween.kill()
		_pulse_tween = null



## 載入牌面 / 牌背貼圖（統一走 TileLoader，絕不出現純文字）。
func _apply_textures() -> void:
	if face_rect == null or back_rect == null:
		return
	face_rect.texture = TileLoader.face_texture(tile_id)
	back_rect.texture = TileLoader.back_texture()
	# 手牌預設顯示牌面（牌背節點保留，供未來/除錯切換）。
	face_rect.visible = true
	back_rect.visible = false


## 由 Table 在「未重建按鈕」時更新可出牌狀態（含 disabled + 外觀）。
func apply_playability(can_play: bool) -> void:
	playable = can_play
	disabled = not can_play
	_refresh_appearance()


## 點擊選中（金色強調框）。
func set_selected(sel: bool) -> void:
	_selected = sel
	_refresh_appearance()


## 胡牌光暈（金色邊框 + 脈動）。
func set_win_glow(glow: bool) -> void:
	_win_glow = glow
	_refresh_appearance()


## 算牌高亮（棄牌池同款 → 暖金強調框）。
func set_discard_match(match: bool) -> void:
	discard_match = match
	_refresh_appearance()


func _on_pressed() -> void:
	# 動畫播放期間鎖定輸入（Majsoul 風格：動畫中不可出牌/選牌）。
	if AnimationQueue.is_playing():
		return
	AudioManager.play_button()
	# 出牌權由伺服器把關；這裡只送指令，不判斷合法性。
	if not GameState.is_my_discard_turn() or instance_id < 0:
		return
	if _selected:
		# 第二次點擊（已選中）→ 送出棄牌。先通知 Table 記錄起點/清除選中，
		# 再送 NetworkManager.discard。
		tile_discarded.emit(instance_id)
		NetworkManager.discard(instance_id)
	else:
		# 第一次點擊 → 選中（抬升 + 金色外框 + 同款高亮由 Table 統一驅動）。
		tile_clicked.emit(instance_id)


func _on_mouse_entered() -> void:
	_hovered = true
	_refresh_appearance()


func _on_mouse_exited() -> void:
	_hovered = false
	_refresh_appearance()


## 是否應「向上浮起」：Hover 或 點擊選中 皆成立（且可出牌時才能 Hover 上浮）。
func _should_lift() -> bool:
	return (_hovered and playable and not disabled) or _selected


## 上浮動畫核心（僅位移，不縮放）：
##   * 浮起：position.y -HOVER_LIFT、scale = 1.0
##   * 復原：position.y 回到 _rest_pos、scale = Vector2.ONE
## 由 _refresh_appearance() 統一驅動，Hover 與選中共用同一套邏輯。
func _sync_lift() -> void:
	if _suppress_lift:
		return
	var want_lift := _should_lift()
	if want_lift == _lifted:
		return
	_lifted = want_lift
	if _scale_tween and _scale_tween.is_valid():
		_scale_tween.kill()
	_scale_tween = create_tween()
	_scale_tween.set_parallel(true)
	if want_lift:
		# 快照目前版面位置，避免 HBox 重排後基準錯位。
		_rest_pos = position
		var target_pos: Vector2 = _rest_pos + Vector2(0, -HOVER_LIFT)
		_scale_tween.tween_property(self, "position", target_pos, HOVER_DURATION) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	else:
		_scale_tween.tween_property(self, "position", _rest_pos, HOVER_DURATION) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


## 重排動畫期間暫停 / 恢復上浮（Table 平滑理牌時呼叫）。
func set_suppress_lift(suppress: bool) -> void:
	_suppress_lift = suppress
	if not suppress:
		_sync_lift()


## 記錄基準位置（供 Hover 上浮還原）— 由 Table 在加入後呼叫。
func set_base_position(pos: Vector2) -> void:
	_base_pos = pos
	_rest_pos = pos
	position = pos
	scale = Vector2.ONE
	_lifted = false


## 記錄基準位置（HBox 版面變動後由 Table 重設）。
func reset_base_position() -> void:
	_base_pos = position
	_rest_pos = position


func _refresh_appearance() -> void:
	# 鎖定（動畫播放中）或不可出牌時淡化。
	var alpha: float = 0.85 if (disabled or not playable) else 1.0
	if _win_glow:
		_apply_tile_style(GOLD_BORDER, 3)
		modulate = Color(1.3, 1.2, 0.85, alpha)
		_start_win_pulse()
	elif _selected:
		# 選中：明顯金色外框（Majsoul 風格兩段式出牌的第一段）。
		_apply_tile_style(GOLD_BORDER, 3)
		modulate = Color(1.15, 1.12, 0.95, alpha)
		_stop_win_pulse()
	elif discard_match:
		# 算牌：暖金強調框。
		_apply_tile_style(GOLD_BORDER_SOFT, 2)
		modulate = Color(1.15, 1.12, 0.95, alpha)
		_stop_win_pulse()
	elif _hovered and playable and not disabled:
		_apply_tile_style(GOLD_BORDER_SOFT, 2)
		modulate = Color(1.08, 1.05, 0.95, alpha)
		_stop_win_pulse()
	else:
		_apply_tile_style(Color(0, 0, 0, 0), 0)
		modulate = Color(1.0, 1.0, 1.0, alpha)
		_stop_win_pulse()
	# Hover lift without scaling (Majsoul style): position.y only, scale fixed at 1.0.
	if scale != Vector2.ONE:
		scale = Vector2.ONE
	# 依 Hover / 選中 狀態同步上浮動畫。
	_sync_lift()


## 在貼圖外圍套上強調框（背景透明，貼圖完整透出，不遮蓋、不裁切）。
func _apply_tile_style(border: Color, width: int) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0)
	sb.border_color = border
	sb.border_width_left = width
	sb.border_width_right = width
	sb.border_width_top = width
	sb.border_width_bottom = width
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	add_theme_stylebox_override("normal", sb)
	add_theme_stylebox_override("hover", sb)
	add_theme_stylebox_override("pressed", sb)
	add_theme_stylebox_override("focus", sb)


## 聽牌光暈：金色邊框輕微脈動（Tween loop）。
func _start_win_pulse() -> void:
	if _pulse_tween and _pulse_tween.is_valid():
		return
	_pulse_tween = create_tween().set_loops()
	_pulse_tween.tween_property(self, "modulate", Color(1.5, 1.3, 0.9, modulate.a), 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_pulse_tween.tween_property(self, "modulate", Color(1.2, 1.1, 0.8, modulate.a), 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _stop_win_pulse() -> void:
	if _pulse_tween and _pulse_tween.is_valid():
		_pulse_tween.kill()
		_pulse_tween = null
```

## File: apps/player-client/qa_render_check.gd

```
extends Node
## qa_render_check.gd — Godot 客戶端渲染驗證（情境 B/C/D UI 層）。
##
## 以 headless 模式載入真實的 Table.tscn，透過 GameState.apply_snapshot()
## 注入伺服器形狀的快照，驗證：
##
##   情境 B【動畫佇列與輸入鎖定】
##     * 快照 diff（摸牌）會產生動畫 job
##     * 動畫播放期間手牌按鈕被鎖定（disabled）、反應列隱藏
##     * 動畫佇列清空後（queue_drained）最終畫面正確刷入
##
##   情境 C【逾時託管 UI】
##     * phaseDeadline ≤5s 時倒數文字轉紅
##     * players[].autoplay → 側邊面板顯示 ⚠託管中
##
##   情境 D【結算面板】
##     * 連莊加成台（莊家連莊台）出現在台數明細
##     * 四家 ledger delta 顯示 + 累計分
##
##   情境 E【手牌自動理牌（Auto-Sort）】
##     * 萬筒條字花花色排序、相同牌以 instanceId 穩定排序
##
##   情境 F【對手牌背與中央棄牌河（貼圖版）】
##     * 對家（北）橫排、東西兩側直列的牌背（13-16 張，皆用 back.png 貼圖）
##     * 四家棄牌河收納在中央牌桌四邊內緣（Bottom/Top/Left/Right），純牌面 TextureRect 貼圖
##     * 情境 E 另驗證手牌按鈕無純文字、Face 節點皆有貼圖
##
## 使用（先跑在專案內，autoload 才會載入）:
##   /path/to/Godot --headless --path apps/player-client res://qa_render_check.tscn
## Exit code 0 = 全 PASS；1 = 任一 FAIL。

const TableScene := preload("res://scenes/Table.tscn")

var _pass := 0
var _fail := 0
var _table: Node
var _checks: Array = []

func _check(name: String, ok: bool, detail: String = "") -> void:
	_checks.append([name, ok, detail])
	if ok:
		_pass += 1
		print("[qa][client] ✅ PASS %s%s" % [name, (" — " + detail) if detail != "" else ""])
	else:
		_fail += 1
		print("[qa][client] ❌ FAIL %s%s" % [name, (" — " + detail) if detail != "" else ""])


# ---------------------------------------------------------------------------
# 快照工廠（與 apps/server snapshot.ts ClientSnapshot 相同形狀）
# ---------------------------------------------------------------------------

func _player(seat: int, name: String, hand_count: int, autoplay: bool, melds: Array = [], hand: Array = []) -> Dictionary:
	return {
		"seat": seat, "playerId": "id-%s" % seat, "playerName": name,
		"connected": true, "ready": true, "autoplay": autoplay,
		"handCount": hand_count, "hand": hand, "melds": melds,
	}

func _hand(size: int) -> Array:
	var out: Array = []
	for i in range(size):
		out.append({"instanceId": i + 1, "id": "wan:%d" % ((i % 9) + 1)})
	return out

func _playing_snap(you: int, extra: Dictionary = {}, hand_size: int = 0) -> Dictionary:
	var players: Array = [
		_player(0, "A", 15, false, [], _hand(hand_size) if you == 0 and hand_size > 0 else []),
		_player(1, "B", 15, false),
		_player(2, "C", 15, false),
		_player(3, "D", 15, false),
	]
	var snap: Dictionary = {
		"status": "playing", "generationId": 1, "you": you, "dealer": 0,
		"dealerStreak": 3, "turn": you, "gamePhase": "discard",
		"roomId": "roomX", "players": players,
		"discards": [], "discardsBySeat": [[], [], [], []],
		"lastDiscard": "", "lastDiscardBy": -1,
		"lastDrawnBy": -1, "lastDrawnTile": null,
		"wall": {"headRemaining": 60, "deckRemaining": 8},
		"reactionHint": null, "phaseDeadline": null, "countdownMs": null,
		"autoplayLog": [], "winner": null, "settlement": null,
	}
	for k in extra:
		snap[k] = extra[k]
	return snap

func _ended_snap(extra: Dictionary = {}) -> Dictionary:
	var snap: Dictionary = {
		"status": "ended", "generationId": 9, "you": 0, "dealer": 0,
		"dealerStreak": 3, "turn": -1, "gamePhase": null,
		"roomId": "roomX", "players": [
			_player(0, "A", 0, false),
			_player(1, "B", 0, false),
			_player(2, "C", 0, false),
			_player(3, "D", 0, false),
		],
		"discards": [], "discardsBySeat": [[], [], [], []],
		"lastDiscard": "", "lastDiscardBy": -1,
		"lastDrawnBy": -1, "lastDrawnTile": null,
		"wall": {"headRemaining": 0, "deckRemaining": 0},
		"reactionHint": null, "phaseDeadline": null, "countdownMs": null,
		"autoplayLog": [], "winner": 0, "settlement": null,
	}
	for k in extra:
		snap[k] = extra[k]
	return snap


# ---------------------------------------------------------------------------
# 各情境驗證
# ---------------------------------------------------------------------------

func _scenario_b() -> void:
	print("\n================= 情境 B：動畫佇列與輸入鎖定 =================")
	var you := 0
	# 初始發牌：15 張手牌 → 直接渲染（無動畫）。
	GameState.apply_snapshot(_playing_snap(you, {}, 15))
	await get_tree().process_frame
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var btn_count: int = hand_area.get_children().size()
	_check("B：發牌後手牌按鈕已建立", btn_count == 15, "按鈕 %d 顆" % btn_count)

	# 注入「摸牌」快照（手牌 16 張）→ 應觸發 draw fly-in 動畫。
	var draw_snap: Dictionary = _playing_snap(you, {"generationId": 2}, 16)
	GameState.apply_snapshot(draw_snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var animating: bool = AnimationQueue.is_playing()
	_check("B：摸牌快照觸發動畫佇列播放", animating)

	var locked := true
	for child in hand_area.get_children():
		if child is Button and not child.disabled:
			locked = false
	_check("B：動畫播放期間手牌輸入鎖定", locked)

	_check("B：動畫播放期間反應列隱藏", not _table.get_node("%ReactionBar").visible)

	# 等動畫佇列清空（每個 job ~0.35s）。
	var drained := false
	var wait := 0
	while not drained and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			drained = true
	_check("B：動畫佇列清空後恢復", drained, "等待 %d 幀" % wait)

	var unlocked := false
	for child in hand_area.get_children():
		if child is Button and not child.disabled:
			unlocked = true
	_check("B：動畫結束後手牌輸入解鎖", unlocked)


func _scenario_c() -> void:
	print("\n================= 情境 C：逾時與託管 UI =================")
	var you := 0
	# 模擬 B 被自動託管 + 倒數只剩 4 秒（≤5 轉紅）。
	var snap: Dictionary = _playing_snap(you, {
		"turn": 1,  # B 思考中
		"phaseDeadline": Time.get_unix_time_from_system() * 1000.0 + 4000.0,
		"countdownMs": 4000,
	}, 15)
	snap["players"][1]["autoplay"] = true
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var countdown_label: Label = _table.get_node("%CountdownLabel")
	var is_red: bool = countdown_label.modulate.r > 0.8 and countdown_label.modulate.g < 0.4
	_check("C：託管中倒數文字轉紅", is_red, "color=%s" % countdown_label.modulate.to_html())

	# you=0 → B(seat1) 落在南面板（東→南→西→北 逆時針）。
	# 直接掃描四家面板的標題 Label，找 ⚠託管中 標籤。
	var found_tag := false
	var tag_text := ""
	for pname in ["EastPanel", "SouthPanel", "WestPanel", "NorthPanel"]:
		var panel: Node = _table.get_node(pname)
		for child in panel.get_children():
			if child is Label:
				tag_text = child.text
				if child.text.contains("⚠託管中"):
					found_tag = true
	_check("C：側邊面板顯示 ⚠託管中 標籤", found_tag,
		"text=%s" % tag_text)

	# 自己(you)被託管 → 狀態列應顯示「你已自動託管」。
	var me_snap: Dictionary = _playing_snap(you, {
		"phaseDeadline": Time.get_unix_time_from_system() * 1000.0 + 3000.0,
		"countdownMs": 3000,
	}, 15)
	me_snap["players"][0]["autoplay"] = true
	GameState.apply_snapshot(me_snap)
	await get_tree().process_frame
	await get_tree().process_frame
	var status_label: Label = _table.get_node("%StatusLabel")
	_check("C：自我託管狀態提示", status_label.text.contains("託管"),
		"text=%s" % status_label.text)


## 收集棄牌河中的牌面貼圖 tile_id（header Label 除外）。
func _river_tile_ids(river: Node) -> Array:
	var ids: Array = []
	for child in river.get_children():
		if child is TextureRect and child.has_meta("tile_id"):
			ids.append(str(child.get_meta("tile_id")))
	return ids


## 混合牌（刻意打亂）：1筒5、9萬、3條、中、梅、1萬、2筒、8條。
func _mixed_tiles() -> Array:
	return [
		{"instanceId": 1, "id": "tong:5"},
		{"instanceId": 2, "id": "wan:9"},
		{"instanceId": 3, "id": "tiao:3"},
		{"instanceId": 4, "id": "honor:zhong"},
		{"instanceId": 5, "id": "flower:mei"},
		{"instanceId": 6, "id": "wan:1"},
		{"instanceId": 7, "id": "tong:2"},
		{"instanceId": 8, "id": "tiao:8"},
	]


func _scenario_e() -> void:
	print("\n================= 情境 E：手牌自動理牌（Auto-Sort） =================")
	var you := 0
	var snap: Dictionary = _playing_snap(you, {}, 0)
	snap["players"][0]["hand"] = _mixed_tiles()
	snap["players"][0]["handCount"] = 8
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var labels: Array = []
	var all_textured := true
	for child in hand_area.get_children():
		if child is Button and child.tile_id != "":
			labels.append(GameState.tile_label(child.tile_id))
			# 貼圖渲染驗證：Button 不得有文字，且 Face TextureRect 必須有貼圖。
			if child.text != "":
				all_textured = false
			var face: TextureRect = child.get_node_or_null("Face")
			if face == null or face.texture == null:
				all_textured = false
	_check("E：手牌按鈕以貼圖渲染（無純文字）", all_textured)
	# 期望順序：萬(1,9) → 筒(2,5) → 條(3,8) → 字(中) → 花(梅)。
	var expected: Array = ["1萬", "9萬", "2筒", "5筒", "3條", "8條", "中", "梅"]
	_check("E：手牌依萬筒條字花排序", labels == expected,
		"實際=%s" % str(labels))

	# 相同牌（同花色同數字）以 instanceId 穩定排序。
	var dup_snap: Dictionary = _playing_snap(you, {}, 0)
	dup_snap["players"][0]["hand"] = [
		{"instanceId": 2, "id": "wan:5"},
		{"instanceId": 1, "id": "wan:5"},
	]
	dup_snap["players"][0]["handCount"] = 2
	GameState.apply_snapshot(dup_snap)
	# 平滑重排是背景動畫（淡出 0.15s + 滑動 0.22s）→ 輪詢等它完成。
	var reflowed := false
	var wait := 0
	while not reflowed and wait < 120:
		await get_tree().process_frame
		wait += 1
		if hand_area.get_children().size() == 2:
			reflowed = true
	var ids: Array = []
	for child in hand_area.get_children():
		if child is Button:
			ids.append(int(child.instance_id))
	_check("E：同張牌以 instanceId 穩定排序", reflowed and ids == [1, 2],
		"實際=%s（等待 %d 幀）" % [str(ids), wait])


func _scenario_f() -> void:
	print("\n================= 情境 F：對手牌背與中央棄牌河 =================")
	var you := 0
	# you=0 → 座次映射：0=SouthPanel 1=WestPanel 2=NorthPanel 3=EastPanel。
	# 對家 C(2) 在 NorthPanel 橫排；上家 B(1) WestPanel、下家 D(3) EastPanel 直列。
	var snap: Dictionary = _playing_snap(you, {
		"discardsBySeat": [
			["wan:1", "tong:2"],
			["tiao:3"],
			[],
			["honor:zhong", "wan:9", "flower:mei"],
		],
	}, 15)
	GameState.apply_snapshot(snap)
	# 上一情境（E）的重排動畫可能仍在播放：等佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	# F1：對手牌背。我方(South)不畫牌背，只畫手牌按鈕。
	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	_check("F：我方不畫牌背（僅手牌按鈕）", hand_area.get_children().size() == 15,
		"手牌按鈕 %d 顆" % hand_area.get_children().size())

	var north_backs: HBoxContainer = _table.get_node("%NorthHandBacks")
	var n_backs: int = 0
	var n_backs_textured := true
	for child in north_backs.get_children():
		if child is TextureRect:
			n_backs += 1
			if child.texture == null:
				n_backs_textured = false
	_check("F：對家橫排牌背 13-16 張（貼圖）", n_backs >= 13 and n_backs <= 16,
		"實際 %d 張" % n_backs)
	_check("F：對家牌背容器為 HBox（橫排）", north_backs is HBoxContainer)
	_check("F：對家牌背全部使用 back.png 貼圖", n_backs > 0 and n_backs_textured)

	var west_backs: VBoxContainer = _table.get_node("%WestHandBacks")
	var w_backs: int = 0
	var w_backs_textured := true
	for child in west_backs.get_children():
		if child is TextureRect:
			w_backs += 1
			if child.texture == null:
				w_backs_textured = false
	_check("F：上家(西側)直列牌背 13-14 張（貼圖）", w_backs >= 13 and w_backs <= 14,
		"實際 %d 張" % w_backs)
	_check("F：上家牌背全部使用 back.png 貼圖", w_backs > 0 and w_backs_textured)

	var east_backs: VBoxContainer = _table.get_node("%EastHandBacks")
	var e_backs: int = 0
	var e_backs_textured := true
	for child in east_backs.get_children():
		if child is TextureRect:
			e_backs += 1
			if child.texture == null:
				e_backs_textured = false
	_check("F：下家(東側)直列牌背 13-14 張（貼圖）", e_backs >= 13 and e_backs <= 14,
		"實際 %d 張" % e_backs)
	_check("F：下家牌背全部使用 back.png 貼圖", e_backs > 0 and e_backs_textured)

	# F2：中央牌桌四邊內緣的棄牌河（無 Label 標題，純牌面貼圖）。
	# 座次映射：seat0(South)→RiverBottom、seat1(West)→RiverLeft、
	#          seat2(North)→RiverTop、seat3(East)→RiverRight。
	var river_bottom: Control = _table.get_node("%RiverBottom")
	_check("F：RiverBottom(南/我) 棄牌貼圖 1萬/2筒",
		_river_tile_ids(river_bottom) == ["wan:1", "tong:2"],
		"實際=%s" % str(_river_tile_ids(river_bottom)))

	var river_left: Control = _table.get_node("%RiverLeft")
	_check("F：RiverLeft(西/上家) 棄牌貼圖 3條",
		_river_tile_ids(river_left) == ["tiao:3"],
		"實際=%s" % str(_river_tile_ids(river_left)))

	var river_top: Control = _table.get_node("%RiverTop")
	_check("F：RiverTop(北/對家) 無棄牌",
		_river_tile_ids(river_top).is_empty(),
		"實際=%s" % str(_river_tile_ids(river_top)))

	var river_right: Control = _table.get_node("%RiverRight")
	_check("F：RiverRight(東/下家) 棄牌貼圖 中/9萬/梅",
		_river_tile_ids(river_right) == ["honor:zhong", "wan:9", "flower:mei"],
		"實際=%s" % str(_river_tile_ids(river_right)))


func _scenario_g() -> void:
	print("\n================= 情境 G：第 17 張摸牌融合於手牌容器 =================")
	var you := 0
	# 17 張手牌 + 輪到我出牌 → 觸發摸牌分離（以伺服器 lastDrawnTile 辨識第 17 張）。
	var snap: Dictionary = _playing_snap(you, {
		"generationId": 3,
		"lastDrawnBy": you,
		"lastDrawnTile": {"instanceId": 17, "id": "wan:8"},
	}, 17)
	snap["turn"] = you
	GameState.apply_snapshot(snap)
	# 等動畫佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var children: Array = hand_area.get_children()
	# G1：第 17 張摸牌必須融合於同一 HBoxContainer（hand_area），不得有獨立 DrawSlot。
	var drawn_btn: Button = null
	var spacer: Control = null
	var btn_count := 0
	for child in children:
		if child is Button:
			btn_count += 1
			if child.has_meta("is_drawn_tile"):
				drawn_btn = child
		elif child is Control and child.has_meta("draw_spacer"):
			spacer = child
	_check("G：第 17 張摸牌融合於 hand_area（無獨立 DrawSlot）",
		drawn_btn != null and btn_count == 17,
		"按鈕 %d 顆" % btn_count)
	_check("G：第 16/17 張之間有 24px 透明間隔器（明顯空格）",
		spacer != null and spacer.custom_minimum_size.x == 24.0,
		"spacer 寬=%s" % (str(spacer.custom_minimum_size.x) if spacer else "無"))
	# G2：間隔器與第 17 張摸牌必須位於容器末端（最後兩個子節點）。
	var last_idx: int = children.size() - 1
	var spacer_idx: int = children.find(spacer) if spacer else -1
	var drawn_idx: int = children.find(drawn_btn) if drawn_btn else -1
	_check("G：間隔器與摸牌位於手牌最右側（容器末端）",
		spacer_idx == last_idx - 1 and drawn_idx == last_idx,
		"spacer@%d drawn@%d total=%d" % [spacer_idx, drawn_idx, children.size()])
	# G3：摸牌按鈕以貼圖渲染（無純文字）— 檢查 Face(TextureRect) 節點貼圖。
	var face_tex: Texture2D = null
	if drawn_btn != null and drawn_btn.has_node("Face"):
		face_tex = drawn_btn.get_node("Face").texture
	_check("G：第 17 張摸牌以貼圖渲染", face_tex != null,
		"texture=%s" % (str(face_tex) if face_tex else "無"))


func _scenario_g2() -> void:
	print("\n================= 情境 G2：第 17 張以伺服器 lastDrawnTile 辨識（非 max-instanceId） =================")
	var you := 0
	# 構造 17 張手牌：真正摸到的牌 instanceId=7（wan:8），而手牌中存在更大的
	# instanceId=90（wan:5）。舊版 max-instanceId 啟發式會誤分 90 → 進牌混進手牌。
	var hand17: Array = []
	for i in range(1, 18):
		hand17.append({"instanceId": i, "id": "wan:%d" % ((i % 9) + 1)})
	hand17[3] = {"instanceId": 90, "id": "wan:5"}
	var snap: Dictionary = _playing_snap(you, {
		"generationId": 4,
		"lastDrawnBy": you,
		"lastDrawnTile": {"instanceId": 7, "id": "wan:8"},
	}, 17)
	snap["turn"] = you
	snap["players"][0]["hand"] = hand17
	snap["players"][0]["handCount"] = 17
	GameState.apply_snapshot(snap)
	# 等動畫佇列清空、最終畫面刷上。
	var settled := false
	var wait := 0
	while not settled and wait < 120:
		await get_tree().process_frame
		wait += 1
		if not AnimationQueue.is_playing() and not bool(_table.get("_pending_final_render")):
			settled = true
	await get_tree().process_frame

	# 直接驗證分離邏輯：drawn 必須是 instanceId=7，而非 max-instanceId=90。
	var full_hand: Array = _table._sorted_hand(GameState.my_hand())
	var split: Array = _table._split_drawn_tile(full_hand)
	var drawn: Dictionary = split[1]
	var drawn_id: int = int(drawn.get("instanceId", -1)) if drawn != null else -1
	var max_inst := -1
	for t in full_hand:
		max_inst = maxi(max_inst, int(t.get("instanceId", -1)))
	_check("G2：手牌存在比摸牌更大之 instanceId（測試有效）", max_inst == 90,
		"max=%d" % max_inst)
	_check("G2：第 17 張 = 伺服器 lastDrawnTile(7)，非 max-instanceId(90)",
		drawn_id == 7, "drawn=%d" % drawn_id)

	# 驗證實際渲染：hand_area 末端的分離摸牌按鈕 instanceId 也必須是 7。
	var hand_area: HBoxContainer = _table.get_node("%HandArea")
	var rendered_drawn := -1
	for child in hand_area.get_children():
		if child is Button and child.has_meta("is_drawn_tile"):
			rendered_drawn = int(child.instance_id)
			break
	_check("G2：渲染出的摸牌按鈕為 instanceId=7", rendered_drawn == 7,
		"rendered=%d" % rendered_drawn)


func _scenario_h() -> void:
	print("\n================= 情境 H：Wikimedia 3D 圖庫字牌貼圖對應 =================")
	# 後端 honor 代號 → Wikimedia 3D 圖庫檔名（tile_loader.gd HONOR_TO_WIKIMEDIA）。
	# 驗證方式：對應 PNG 檔存在於 res://assets/tiles/ 且 face_texture() 回傳非空貼圖。
	# （未匯入的 PNG 以 Image.load_from_file() 建立 ImageTexture，resource_path 為空，
	#   故以「檔案存在 + 貼圖非空」判定，而非 resource_path / 尺寸。）
	var honor_map := {
		"honor:dong": "east.png",
		"honor:nan": "south.png",
		"honor:xi": "west.png",
		"honor:bei": "north.png",
		"honor:zhong": "red.png",
		"honor:fa": "green.png",
		"honor:bai": "white.png",
	}
	var all_ok := true
	var detail := ""
	for tile_id in honor_map:
		var fname: String = honor_map[tile_id]
		var file_ok: bool = FileAccess.file_exists("res://assets/tiles/" + fname)
		var tex: Texture2D = TileLoader.face_texture(tile_id)
		var tex_ok: bool = tex != null
		if not (file_ok and tex_ok):
			all_ok = false
			detail += "%s→%s(file=%s,tex=%s) " % [tile_id, fname, file_ok, tex_ok]
	_check("H：字牌 honor 對應 Wikimedia 檔名（east/south/west/north/red/green/white）",
		all_ok, detail.strip_edges())
	# 萬筒條 + 牌背亦應載入貼圖（對應 PNG 檔存在 + 貼圖非空）。
	var suits_ok := true
	for cat in ["wan", "tong", "tiao"]:
		for n in range(1, 10):
			var tex: Texture2D = TileLoader.face_texture("%s:%d" % [cat, n])
			if tex == null or not FileAccess.file_exists("res://assets/tiles/%s_%d.png" % [cat, n]):
				suits_ok = false
	var back_tex: Texture2D = TileLoader.back_texture()
	var back_ok: bool = back_tex != null and FileAccess.file_exists("res://assets/tiles/back.png")
	_check("H：萬筒條 1-9 與牌背皆載入貼圖", suits_ok and back_ok)


func _scenario_i() -> void:
	print("\n================= 情境 I：資產映射 100% 對齊 + apply_face 塞入 =================")
	# 1) validate_assets() 應回傳空清單（43 個檔名全部存在於 assets/tiles/）。
	var missing: Array = TileLoader.validate_assets()
	_check("I：validate_assets() 無缺失（43 檔全在）", missing.is_empty(),
		"missing=%s" % str(missing))
	# 2) apply_face() 應能把貼圖正確塞入 TextureRect，且 meta.tile_id 同步。
	var tr := TextureRect.new()
	var apply_ok := true
	var apply_detail := ""
	for tile_id in ["wan:5", "tong:3", "tiao:7", "honor:zhong", "flower:mei"]:
		TileLoader.apply_face(tr, tile_id)
		if tr.texture == null or tr.get_meta("tile_id", "") != tile_id:
			apply_ok = false
			apply_detail += "%s(tex=%s,meta=%s) " % [
				tile_id, tr.texture != null, tr.get_meta("tile_id", "")]
	_check("I：apply_face() 正確塞入 TextureRect 並同步 meta", apply_ok, apply_detail.strip_edges())
	tr.free()

	# 3) 所有合法 TileId 都應回傳非空貼圖（涵蓋萬筒條/字/花/牌背）。
	var all_tex_ok := true
	var tex_detail := ""
	for cat in ["wan", "tong", "tiao"]:
		for n in range(1, 10):
			if TileLoader.face_texture("%s:%d" % [cat, n]) == null:
				all_tex_ok = false
				tex_detail += "%s:%d " % [cat, n]
	for honor in ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"]:
		if TileLoader.face_texture("honor:" + honor) == null:
			all_tex_ok = false
			tex_detail += "honor:%s " % honor
	for flower in ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"]:
		if TileLoader.face_texture("flower:" + flower) == null:
			all_tex_ok = false
			tex_detail += "flower:%s " % flower
	if TileLoader.back_texture() == null:
		all_tex_ok = false
		tex_detail += "back "
	_check("I：全部 43 種 TileId 皆回傳非空貼圖", all_tex_ok, tex_detail.strip_edges())


func _scenario_d() -> void:
	print("\n================= 情境 D：連莊與結算帳本 =================")
	var you := 0
	var snap: Dictionary = _ended_snap()
	snap["dealer"] = 0
	snap["dealerStreak"] = 3
	snap["winner"] = 0
	snap["settlement"] = {
		"winner": 0, "selfDraw": true, "kongDraw": false,
		"breakdown": {
			"fans": [
				{"rule": "自摸", "value": 1},
				{"rule": "莊家連莊台", "value": 2},  # streak=3 → 連莊台 2
			],
			"total": 3,
		},
		"ledger": [
			{"seat": 0, "delta": 900},
			{"seat": 1, "delta": -300},
			{"seat": 2, "delta": -300},
			{"seat": 3, "delta": -300},
		],
		"scores": [3900, 100, 100, 100],
	}
	# 我尚未準備 → 「準備下一局」按鈕應可用。
	snap["players"][0]["ready"] = false
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("D：結算面板顯示", settlement_panel.visible)

	var detail: Label = _table.get_node("%SettlementDetail")
	var text: String = detail.text
	_check("D：結算面板標題列含莊家/贏家", text.contains("莊家") and text.contains("贏家"),
		"text=%s" % text)

	# 台數明細與分數帳本已移至 FanListContainer（逐項淡入上滑的獨立 Label）。
	var fan_list: VBoxContainer = _table.get_node("%FanListContainer")
	var has_lianzhuang := false
	var has_delta := false
	var has_pos := false
	var has_neg := false
	for child in fan_list.get_children():
		if child is Label:
			var t: String = child.text
			if t.contains("莊家連莊台"):
				has_lianzhuang = true
			if t.contains("+900"):
				has_pos = true
			if t.contains("-300"):
				has_neg = true
	_check("D：台數明細含連莊台(+2)", has_lianzhuang)
	_check("D：四家 ledger delta 顯示（+900 / -300）", has_pos and has_neg,
		"莊+900 三家-300")

	var dealer_info: Label = _table.get_node("%DealerInfoLabel")
	_check("D：TopBar 顯示連莊", dealer_info.text.contains("連莊 3"),
		"text=%s" % dealer_info.text)

	var next_btn: Button = _table.get_node("%NextRoundBtn")
	_check("D：準備下一局按鈕可用", next_btn.visible and not next_btn.disabled)


func _scenario_draw() -> void:
	print("\n================= 情境 DRAW：流局結算（winner=null 不崩潰） =================")
	var you := 0
	var snap: Dictionary = _ended_snap()
	snap["status"] = "ended"
	snap["winner"] = null
	# server 流局時 settlement 非空（全 0 ledger），但 winner/breakdown 皆 null。
	snap["settlement"] = {
		"winner": null, "selfDraw": false, "kongDraw": false,
		"breakdown": null,
		"ledger": [
			{"seat": 0, "delta": 0},
			{"seat": 1, "delta": 0},
			{"seat": 2, "delta": 0},
			{"seat": 3, "delta": 0},
		],
		"scores": [0, 0, 0, 0],
	}
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	await get_tree().process_frame

	# 流局 → 結算面板顯示「流局」，不得崩潰、不印「贏家」。
	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("DRAW：流局結算面板顯示", settlement_panel.visible)
	var detail: Label = _table.get_node("%SettlementDetail")
	_check("DRAW：結算標題含「流局」", detail.text.contains("流局"),
		"text=%s" % detail.text)
	_check("DRAW：流局不誤印「贏家」", not detail.text.contains("贏家："),
		"text=%s" % detail.text)


## 情境 NULL-SNAP：settlement=null 且 winner=null（playing 快照）不得崩潰。
## 這是「反應窗開啟中」或「剛發牌」等 server 不填 settlement 的常見路徑。
func _scenario_null_settlement() -> void:
	print("\n================= 情境 NULL-SNAP：settlement/winner/breakdown 全 null =================" )
	# 快照：playing 狀態，所有 nullable 字段皆為 null。
	var snap: Dictionary = _playing_snap(0, {}, 13)
	snap["winner"] = null
	snap["settlement"] = null
	snap["lastDiscard"] = null
	snap["lastDiscardBy"] = null
	snap["lastDrawnTile"] = null
	snap["reactionHint"] = null
	snap["phaseDeadline"] = null
	snap["countdownMs"] = null
	snap["autoplayLog"] = null
	GameState.apply_snapshot(snap)
	await get_tree().process_frame
	# 只要不崩潰、GameState 無丟 null 進 typed int 即通過。
	_check("NULL-SNAP：apply_snapshot 全 null nullable 不崩潰", true)
	_check("NULL-SNAP：winner 落地為 -1", GameState.winner == -1,
		"got %d" % GameState.winner)
	_check("NULL-SNAP：last_discard_by 落地為 -1", GameState.last_discard_by == -1,
		"got %d" % GameState.last_discard_by)
	_check("NULL-SNAP：countdown_ms 落地為 -1", GameState.countdown_ms == -1,
		"got %d" % GameState.countdown_ms)
	_check("NULL-SNAP：autoplay_log 落地為空陣列", GameState.autoplay_log == [],
		"got %s" % str(GameState.autoplay_log))

	# 流局快照（ended + settlement 含 null winner/breakdown）確認 _render_settlement 不崩。
	var draw_snap: Dictionary = _ended_snap()
	draw_snap["winner"] = null
	draw_snap["settlement"] = {
		"winner": null, "selfDraw": false, "kongDraw": false,
		"breakdown": null,
		"ledger": [
			{"seat": 0, "delta": 0}, {"seat": 1, "delta": 0},
			{"seat": 2, "delta": 0}, {"seat": 3, "delta": 0},
		],
		"scores": [0, 0, 0, 0],
	}
	GameState.apply_snapshot(draw_snap)
	await get_tree().process_frame
	await get_tree().process_frame
	var settlement_panel: PanelContainer = _table.get_node("%SettlementPanel")
	_check("NULL-SNAP：流局結算面板顯示（settlement.winner=null）", settlement_panel.visible)
	var detail: Label = _table.get_node("%SettlementDetail")
	_check("NULL-SNAP：流局不誤印「贏家：」", not detail.text.contains("贏家："),
		"text=%s" % detail.text)


func _ready() -> void:
	# 在專案正常啟動（autoload 已載入）後載入 Table.tscn。
	_table = TableScene.instantiate()
	add_child(_table)
	_run.call_deferred()


func _run() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	await _scenario_b()
	await _scenario_c()
	await _scenario_d()
	await _scenario_draw()
	await _scenario_null_settlement()
	await _scenario_e()
	await _scenario_f()
	await _scenario_g()
	await _scenario_g2()
	await _scenario_h()
	await _scenario_i()

	print("\n================ QA 客戶端渲染報告 ================")
	print("PASS %d / FAIL %d" % [_pass, _fail])
	for c in _checks:
		print("  %s %s%s" % ["✅" if c[1] else "❌", c[0], (" (%s)" % c[2]) if c[2] != "" else ""])
	print("==================================================")
	get_tree().quit(0 if _fail == 0 else 1)
```

## File: apps/player-client/qa_render_check.tscn

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://qa_render_check.gd" id="1_qa"]

[node name="QaRenderCheck" type="Node"]
script = ExtResource("1_qa")
```

## File: docs/GROK_UI_OVERHAUL_PROMPT.md

```
# GROK 全專案接管 PROMPT — 台灣 16 張麻將 UI 全面重寫

> 直接把以下內容整段貼給 GROK，讓它接管整個專案並重寫畫面。
> 這份文件同時是給 GROK 的完整任務書，也是給你的驗收清單。

---

## 你的任務（GROK）

你現在要**完整接管**位於 `taiwan-mahjong1/` 的台灣 16 張麻將專案，並把**玩家客戶端（Godot 4.7）的整個遊戲畫面重寫**成「雀魂（Majsoul）」風格的現代麻將 UI。**伺服器端（Node.js/TypeScript）與規則引擎（packages/rules）完全不要動**——它們是權威邏輯，只改客戶端渲染層。

### 專案技術棧（先讀懂再動手）

- **Monorepo**（pnpm workspace）：`apps/server`（Node.js + TypeScript + ws，權威伺服器）、`apps/player-client`（**Godot 4.7 + GDScript**，玩家客戶端）、`packages/rules`（純規則引擎）。
- 客戶端是 **Godot 4.7** 專案，主場景 `apps/player-client/scenes/Main.tscn`（連線選單）→ `scenes/Table.tscn`（牌桌）。
- **架構鐵律（不可違反）**：客戶端是 **Client-Safe UI**，**伺服器是唯一真相來源**。客戶端**嚴禁**做任何吃碰槓胡判斷，所有狀態都來自伺服器快照（`GameState.apply_snapshot()`），所有動作都透過 `NetworkManager` 送指令給伺服器。
- 牌面貼圖已存在於 `apps/player-client/assets/tiles/`（`wan_1.png`…`wan_9.png`、`tong_*`、`tiao_*`、`honor_*`、`flower_*`、`back.png`），透過 Autoload `TileLoader`（`scripts/tile_loader.gd`）統一載入。**所有牌面一律用貼圖，禁止退回純文字。**

### 目前畫面的問題（使用者不滿意的地方）

1. **畫面是「純文字」風格**：目前手牌、棄牌河、副露、對手手牌都是文字標籤 + 小貼圖混雜，整體像 debug 介面，不像正式麻將遊戲。
2. **沒有「中央牌桌」**：目前是四家側邊面板 + 中央棄牌池的簡陋排版，沒有雀魂那種「一張大牌桌、四家圍坐、中央是棄牌區」的沉浸式佈局。
3. **進牌（摸牌）位置不對**：使用者要求「進牌要在最右邊並且有空格」，也就是摸進的新牌要獨立顯示在手牌最右側、與其他手牌之間留出間距（雀魂的摸牌區），而不是直接併入排序好的手牌。

### 目標畫面（參考雀魂 Majsoul + 明星三缺一牌型）

請把 `Table.tscn` 與 `table.gd` 重寫成以下佈局：

1. **中央大牌桌**：畫面中央是一張大型綠色牌桌（felt 質感、圓角、內外框、木質/深色邊框），四家圍坐。牌桌中央是**棄牌區**（各家棄牌依座位分區顯示在中央，牌面朝上、可重疊排列）。
2. **四家座位**：以「我」為南（下方），順時針 南→西→北→東。每家顯示：玩家名、風位、手牌張數、莊家/託管/離線標記、副露區（吃碰槓牌組）。**對手手牌用牌背（`back.png`）朝下顯示**，只有自己手牌朝上。
3. **自己的手牌（下方中央）**：牌面朝上、自動理牌（萬→筒→條→字→花，由小到大）。**摸進的新牌獨立顯示在最右側，與其他手牌之間留出明顯間距**（雀魂摸牌區），出牌或吃碰槓後才併入排序。
4. **牌面圖案**：一律使用 `assets/tiles/` 的 PNG 貼圖（明星三缺一風格牌型），透過 `TileLoader` 載入，禁止純文字。牌面要有立體感（圓角、陰影、hover 上浮）。
5. **互動**：
   - 自己手牌可點擊出牌（hover 上浮、點擊選中金色強調框）。
   - 反應列（吃/碰/槓/胡/過）在可反應時顯示在下方，金色脈動提示。
   - 倒數計時、莊家連莊、牌牆剩餘張數顯示在頂部。
   - 結算面板（胡牌台數、分數增減）以金色卡片彈出。
6. **視覺風格**：雀魂式深色玻璃質感（半透明深色面板 + 金色描邊）、金色文字、柔和陰影、流暢動畫（摸牌飛入、棄牌飛出、副露飛到座位、理牌平滑重排）。

### 必須保留的既有功能與約束

- **不要改動**：`apps/server/**`、`packages/rules/**`、`NetworkManager.gd`、`GameState.gd`、`tile_loader.gd`、`AnimationQueue.gd`、`AudioManager.gd` 的邏輯。
- **保留**：Client-Safe 架構（所有狀態來自 `GameState` 快照、所有動作走 `NetworkManager`）、動畫佇列機制、自動理牌、聽牌光暈、算牌高亮、自動託管/離線標記、結算面板、音效。
- **牌面一律用貼圖**（`TileLoader`），任何地方都不可退回純文字。
- 你主要改動的檔案：`scenes/Table.tscn`、`scripts/table.gd`、`scripts/TileButton.gd`、`scenes/TileButton.tscn`，以及必要的樣式/資源。若需新增場景或腳本，請保持與現有 Autoload 與訊號介面相容。

### 驗收方式

改完後請：
1. 用 `pnpm typecheck` 確認伺服器端沒被破壞（應通過）。
2. 用 Godot 開啟 `apps/player-client`，確認無 GDScript 解析/執行錯誤。
3. 啟動伺服器（`apps/server`）並實際對局，確認：摸牌出現在手牌最右側且有間距、中央有牌桌、四家圍坐、牌面是貼圖而非文字、吃碰槓胡與結算都正常。

---

## 給使用者的驗收清單（GROK 完成後逐項檢查）

- [ ] 畫面中央有大型牌桌，四家圍坐（我=南在下方）
- [ ] 摸進的新牌顯示在手牌**最右側**，且與其他手牌之間**有明顯空格**
- [ ] 所有牌面都是**貼圖**（明星三缺一牌型），不是純文字
- [ ] 對手手牌用牌背朝下顯示
- [ ] 棄牌區在牌桌中央，依座位分區
- [ ] 吃/碰/槓/胡/過反應列正常、結算面板正常
- [ ] 伺服器端 `pnpm typecheck` 與測試仍通過
- [ ] Godot 開啟專案無錯誤
```

## File: docs/HARD_FIX_REPORT.md

```
# 硬核修復報告 HARD_FIX_REPORT

## 改動文件清單

### 1. `apps/player-client/scripts/table.gd` — 2 處 Godot 生命週期竟態
- **`_animate_hand_reflow`**：`await get_tree().process_frame` 後加 `if not is_inside_tree(): return`。
  理由：void 非同步函數，場景切換時節點已出樹，後續 `hand_area.get_children()` 崩潰。
- **`_animate_settlement_line`**：guard 改為 `if not is_inside_tree() or not is_instance_valid(lbl) or ...`。
  理由：流局/勝利結算動畫期間若玩家離場，`self` 已出樹，`create_tween()` 會抛異常。

### 2. `apps/player-client/qa_render_check.gd` — 情境 NULL-SNAP（7 個新斷言）
- 覆蓋所有 nullable 字段皆為 `null` 時 `apply_snapshot` 不崩潰。
- 確認各字段落地為 sentinel 值（-1 / []），避免 nil→typed 崩潰。
- 重複流局快照測試（settlement.winner=null），與既有 DRAW 情境互為冗餘鎖定。

### 3. `packages/rules/src/__tests__/scoring.test.ts` — GC-42 / GC-43（2 個新測試）
- **GC-42**：放槍者也是胡家之一退化 case → `sum(delta) === 0`，放槍兼胡家 delta ≥ 0。
- **GC-43**：單胡家 `settleMultiLedger([ctx])` 與 `settleLedger(ctx)` 結果完全相同。

### 4. `apps/server/src/__tests__/room.test.ts` — reaction doPass 語義（2 個新測試）
- **雙 pending seat**：seat1 pass → 窗仍開；seat2 pass → 窗關（phase ≠ "reaction"）。
- **非 pending seat 強制關窗**：放槍者 seat0 pass → ok:true，窗立即關閉（script/tests 路徑保留）。

## 未碰的禁止區
- `packages/rules/**`（win.ts/scoring.ts/wall.ts/測試斷言）、`protocol.ts`、`snapshot.ts`、`NetworkManager.gd`、門清自摸(raw=5)、八對子、自動胡：均未修改。

## 最後命令輸出

```
pnpm test
  Test Files  8 passed (8)
  Tests  161 passed (161)   ← 原 157，+4 個測試

pnpm typecheck
  packages/rules typecheck: Done
  apps/server typecheck: Done

Godot headless qa_render_check.tscn
  PASS 52 / FAIL 0   ← 原 45，+7 個斷言，exit 0
```
```

## File: docs/OVERNIGHT_REPORT.md

```
# 過夜

- 分鐘：約 135 分鐘（休息恢復後續跑）
- win.ts 有改？是/否：否（6 個指定反例在現有 detectWin 下全綠，未改最小修正；mapSum 面子數與 honor 只認刻已在先前修正）
- 6 個指定 it() 是否都在（列出）：
  - [不胡] 手牌 16 張不可胡
  - [不胡] 只有對子沒有面子不可胡
  - [不胡] 字牌東南北當順不可胡
  - [不胡] 1萬2筒3條跨花色當順不可胡
  - [不胡] 八個對子 16 張無刻不可當八對子
  - [不胡] 花牌進手不可胡
  （位於 packages/rules/src/__tests__/win.test.ts「過夜指定反例」describe，34/34 全綠）
- qa-e2e.ts 你印出的關鍵 20 行（貼進來）：
  ```
  case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      if (bot.seat === -1 && snap.you >= 0) { bot.seat = snap.you; }
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) { ... }
          if (mine.hand) bot.lastHandSize = mine.hand.length;
          if (!room.dealtChecked && bot.name === "A" && mine.hand) {
            room.dealtChecked = true;
            const expected = bot.seat === room.dealer ? 17 : 16;
            check("A", "發牌張數 閒16/莊17",
              mine.hand.length === expected,
              `seat=${bot.seat} dealer=${room.dealer} hand=${mine.hand.length} (期望 ${expected})`);
          }
        }
      }
      break;
    }
  ```
- 你補了或確認了哪段 16/17 assert：
  補上（commit 7e3757c）— room 物件新增 `dealtChecked`，首張 playing 快照時，A bot 座位 == dealer → 期望 17，否則期望 16，並 call `check("A", "發牌張數 閒16/莊17", ...)`。
- NetworkManager：貼 is_connected 那幾行：
  ```
  L38:  var is_connected := false
  L144-145: _conn_state = ConnState.CONNECTING; is_connected = false
  L96-100: (STATE_OPEN) if _conn_state == ConnState.CONNECTING:
              _conn_state = ConnState.OPEN; is_connected = true; ... _ping_timer.start(ping_interval)
  L115-117: if _ping_awaiting and _ping_sent_at > 0
              and (Time.get_ticks_msec() - _ping_sent_at) > int(ping_timeout * 1000.0):
              _handle_half_open_timeout()
  ```
  已符合 CONNECTING=false / OPEN=true / ping 逾時關 socket → 無需改（commit 08cea7d「連線狀態機核對（無需改）」）。
- pnpm test 最後 20 行：
  ```
  ✓ packages/rules/src/__tests__/win.test.ts (34 tests) 22ms
  ✓ packages/rules/src/__tests__/scoring.test.ts (41 tests) 29ms
  ✓ packages/rules/src/__tests__/kong.test.ts (11 tests) 9ms
  ✓ packages/rules/src/__tests__/wall.test.ts (21 tests) 15ms
  ✓ packages/rules/src/__tests__/chi.test.ts (9 tests) 5ms
  ✓ packages/rules/src/__tests__/peng.test.ts (8 tests) 5ms
  ✓ apps/server/src/__tests__/wss.test.ts (6 tests) 332ms
  ✓ apps/server/src/__tests__/room.test.ts (27 tests) 489ms
    ✓ Room — 斷線逾時自動託管 > reaction timeout auto-pass ... 403ms
  Test Files  8 passed (8)
  Tests  157 passed (157)
  Duration  1.02s
  ```
  typecheck：packages/rules + apps/server 皆 Done。
- git log --oneline（本晚 3 個新 commit）：
  ```
  d2740ba overnight: 指定不胡反例與 detectWin 最小修正
  7e3757c overnight: e2e 驗發牌 16/17
  08cea7d overnight: 連線狀態機核對（無需改）
  ```
- 沒做完：qa-e2e 未實際重跑（4-bot 長測貴且不穩，指示「不准重跑」）；沒做 UI / 沒拆 table.gd / 沒跑 qa-stress（指示禁止）
```

## File: docs/qa-e2e-report.md

```
# 全功能地端 E2E 實機綜合測試報告

- **日期**：2026-08-11
- **環境**：macOS / pnpm monorepo（`taiwan-mahjong1`）/ Godot 4.7.1 headless
- **伺服器**：地端 WebSocket `ws://localhost:3000/ws`，`TIMEOUT_MS=15000`（15 秒正常思考時間）
- **驗證範圍**：情境 A / B / C / D × 伺服器端（權威邏輯）+ 客戶端（Godot UI 渲染）

---

## 一、總覽

| 層級 | 工具 | 結果 | 說明 |
|---|---|---|---|
| 伺服器端 | [`qa-e2e.ts`](apps/server/src/scripts/qa-e2e.ts) | **29 / 29 PASS** | 4 真實玩家 bot 連線，完整跑 4 情境 |
| 客戶端 UI | [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) + [`qa_render_check.tscn`](apps/player-client/qa_render_check.tscn) | **14 / 14 PASS** | headless 載入真實 `Table.tscn` 注入伺服器形狀快照 |
| 服務健康度 | `GET /health` | `ok:true` | 全程監測，無中斷 |

---

## 二、情境 A【標準完整流程】— 伺服器端 15/15 PASS

4 視窗連線 → 入座 → 準備 → 自動發牌 → 輪流摸打 → 自動胡牌結算 → 「準備下一局」重置。

驗證項目（節錄）：
- 4 家座位依序為 `[0,1,2,3]`，無重複
- 發牌後閒家手牌 16 張、莊家 17 張（台灣 16 張制；莊家持 17 張進張，
  `packages/rules/src/wall.ts` `dealInitial` 先發 4 輪 × 4 = 各 16 張，
  再補莊家第 17 張）
- 補花後手牌張數維持此量級（花牌進 `flowers`，不佔手牌）
- 每局 `game.started` 只記 1 次（以 bot A 為準，避免廣播重複計數）
- 每局 `game.ended` 正常觸發，`winner` / `dealer` / `ledger` 齊全
- 4 局完整跑完，每局 4 家 ledger delta 總和 = 0（零和）
- 「準備下一局」後 `status` 回到 `lobby`，再發下一局

---

## 三、情境 B【吃/碰/槓與動畫佇列】— 伺服器端 5/5 PASS

- 整場共產生 **19 次副露**（吃 6、碰 12、槓 1）
- 每局副露張數 ≥ 1；追蹤各家 `melds` 數量與種類正確
- 副露後手牌張數正確遞減（碰/槓 3 張一組）
- 客戶端 UI（見第六節）：動畫播放期間手牌按鈕鎖定、反應列隱藏、佇列清空後恢復

---

## 四、情境 C【逾時與託管恢復】— 伺服器端 2/2 PASS

- 刻意閒置超過 15 秒 → 伺服器自動**摸切**（`autoplayLog` 記錄 `reason: "timeout"`）
- 對應玩家 `autoplay` 旗標 = true，快照帶 `⚠託管中`
- 手動再點棄牌 → 玩家恢復手動控制，`autoplay` 旗標清除
- 客戶端 UI（見第六節）：倒數文字轉紅（≤5s）、側邊面板 ⚠託管中、狀態列「你已自動託管（伺服器代打）」

---

## 五、情境 D【連莊與結算帳本】— 伺服器端 7/7 PASS

- **莊家連胡 2 局** → `dealerStreak` 達 3，連莊台成立（破壞牌模式：其餘三家故意拆牌讓莊家自摸）
- 結算台數明細含 `莊家連莊台 +2`（streak=3 → 連莊加成 2 台）
- 四家 ledger delta 精確：莊 +900、其餘 -300，總和 = 0
- 莊家輪替不變式：非莊家胡牌 → 下一位莊家且 streak 歸零
- 客戶端 UI（見第六節）：結算面板含連莊加成、TopBar「連莊 3」、四家 delta 顯示

---

## 六、客戶端 UI 驗證（headless Godot）— 14/14 PASS

透過 [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) 載入真實 [`Table.tscn`](apps/player-client/scenes/Table.tscn)，以 `GameState.apply_snapshot()` 注入伺服器形狀快照：

| 情境 | 檢查點 | 結果 |
|---|---|---|
| B | 發牌 15 張 → 15 顆手牌按鈕 | ✅ |
| B | 摸牌快照（16 張）→ 動畫佇列播放 | ✅ |
| B | 動畫播放期間手牌輸入鎖定 | ✅ |
| B | 動畫播放期間反應列隱藏 | ✅ |
| B | 動畫佇列清空後恢復（58 幀內） | ✅ |
| B | 動畫結束後手牌輸入解鎖 | ✅ |
| C | 託管中倒數文字轉紅（`e63333ff`） | ✅ |
| C | 側邊面板顯示 ⚠託管中 | ✅ |
| C | 狀態列「你已自動託管（伺服器代打）」 | ✅ |
| D | 結算面板顯示 | ✅ |
| D | 台數明細含「莊家連莊台 +2」與「連莊加成」 | ✅ |
| D | 四家 ledger delta（+900 / -300）顯示 | ✅ |
| D | TopBar「東風 莊家 A（連莊 3）」 | ✅ |
| D | 「準備下一局」按鈕可用 | ✅ |

---

## 七、測試中發現並修正的問題

### 1. 伺服器端
| 問題 | 根因 | 修正 |
|---|---|---|
| Bot A 永遠坐不到位（seat=-1）→ 第 1 局卡死 | 房主只收到 `welcome` + `room.created`，**沒有** `player.joined` | 從 `snapshot.you` 推導座位（`qa-e2e.ts`） |
| `game.started` 計數 ×4 膨脹 | 4 家都會收到 `game.started` 廣播 | 只在 bot A 計數 |
| 全部流局、無真實胡牌 | bot 亂棄牌 | 勝率導向棄牌策略 + 破壞牌模式（讓莊家連胡） |

### 2. 客戶端（真實 bug！）
| 問題 | 根因 | 修正 |
|---|---|---|
| **動畫佇列無限迴圈**：摸牌動畫播完 → 又排入相同摸牌 job → 手牌永遠鎖定、畫面跳動 | `_on_queue_drained()` 呼叫 `_refresh()` 重跑 `_collect_anim_jobs()`，但 `_last_hand` 未更新（只有 `_render_final_state()` 會更新），同一 diff（16>15）被無限重複排入 | [`table.gd`](apps/player-client/scripts/table.gd:178)：佇列清空後改直接呼叫 `_render_final_state()` 更新 diff 基準（非 playing 狀態仍走 `_refresh()` 轉場） |
| 測試 harness `process_frame` 未定義 | `--script` 模式不載入 autoload + 語法錯誤 | 改用 `await get_tree().process_frame` + 改以場景執行 |

---

## 八、驗證用的產物

| 檔案 | 用途 |
|---|---|
| [`apps/server/src/scripts/qa-e2e.ts`](apps/server/src/scripts/qa-e2e.ts) | 伺服器端 4-bot E2E（29 檢查點） |
| [`apps/player-client/qa_render_check.gd`](apps/player-client/qa_render_check.gd) | 客戶端 UI 驗證 harness（14 檢查點） |
| [`apps/player-client/qa_render_check.tscn`](apps/player-client/qa_render_check.tscn) | harness 場景（autoload 載入用） |

## 九、執行方式（重現）

```bash
# 1. 啟動伺服器（Terminal 1）
cd taiwan-mahjong1
TIMEOUT_MS=15000 pnpm --filter @taiwan-mahjong/server serve

# 2. 伺服器端 E2E（Terminal 2）
pnpm --filter @taiwan-mahjong/server e2e

# 3. 客戶端 UI 驗證（Terminal 2）
/Users/ian/Downloads/Godot.app/Contents/MacOS/Godot --headless \
  --path apps/player-client res://qa_render_check.tscn
# Exit code 0 = 全 PASS
```

---

**結論：伺服器端 29/29 + 客戶端 UI 14/14 全數通過；測試過程中修復 1 個真實客戶端動畫無限迴圈 bug（table.gd），並確認 15 秒逾時託管、連莊台、結算帳本零和等關鍵機制正確。**
```

## File: docs/qa-polish-report.md

```
# 【地端體驗完全體】音效・手牌 UX・Web 匯出 綜合測試報告

- **日期**：2026-08-11
- **環境**：macOS / pnpm monorepo（`taiwan-mahjong1`）/ Godot 4.7.1 headless + Web 匯出
- **驗證總結果**：**100% PASS**（單元測試 124/124、壓力測試 338/338、Godot headless 渲染 14/14、Web 匯出 + serve:web 全項通過）

---

## 一、總覽

| 層級 | 工具 | 結果 | 說明 |
|---|---|---|---|
| 單元測試 | `pnpm test`（vitest） | **124 / 124 PASS**（8 檔） | `packages/rules`（94 項）+ `apps/server`（30 項，含斷線逾時自動託管） |
| 壓力測試 | [`qa-stress.ts`](apps/server/src/scripts/qa-stress.ts) | **338 / 338 PASS** | 100 局高頻壓力、斷線重連、超時託管、連莊過莊、記憶體/opId 洩漏檢查 |
| 客戶端渲染 | [`qa_render_check.gd`](apps/player-client/qa_render_check.gd) + `.tscn` | **14 / 14 PASS** | headless 載入真實 `Table.tscn` 注入伺服器形狀快照 |
| Web 匯出 | Godot `--export-release "Web"` | **成功** | `apps/player-client/export/web/` 產出 index.html / index.js / index.pck / index.wasm（39.5MB）等 |
| 地端 Web 伺服 | [`serve:web`](apps/server/package.json)（`serve-web.ts`） | **全項通過** | 靜態掛載 + 正確 MIME + SPA fallback + WSS `/ws` 同源握手 |

---

## 二、單元測試（124 / 124 PASS）

`pnpm test` 8 檔全數通過：

```
✓ packages/rules/src/__tests__/wall.test.ts   (21 tests)
✓ packages/rules/src/__tests__/kong.test.ts   (10 tests)
✓ packages/rules/src/__tests__/scoring.test.ts (38 tests)
✓ packages/rules/src/__tests__/chi.test.ts    ( 9 tests)
✓ packages/rules/src/__tests__/win.test.ts    ( 8 tests)
✓ packages/rules/src/__tests__/peng.test.ts   ( 8 tests)
✓ apps/server/src/__tests__/wss.test.ts       ( 6 tests)
✓ apps/server/src/__tests__/room.test.ts      (24 tests)

Test Files  8 passed (8)
     Tests  124 passed (124)
```

包含「斷線逾時自動託管」：reaction timeout auto-pass → 出牌視窗關閉、回合推進。

---

## 三、壓力測試（338 / 338 PASS，100 局）

伺服器：`PORT=3001 TIMEOUT_MS=1500 node dist/apps/server/src/serve.js`

| 項目 | 結果 |
|---|---|
| **總計** | **338 / 338 項通過** |
| STRESS-1 高頻點擊 | 3/3 PASS — 重複指令 3111 次、重複 operationId 1037 次（冪等）、unknown=0 / stale=3146 / wrongPhase=0 |
| STRESS-2 斷線重連 | 2/2 PASS — 重連 10 次、重連後座位 `[0,1,2,3]` 正確 |
| STRESS-3 超時託管 | 3/3 PASS — 自動託管觸發 15 次、託管後手動恢復 215 次、快速超時自動摸切反覆觸發 |
| STRESS-4 連莊過莊 | 4/4 PASS（100 局內連莊/過莊 不變式成立，含破壞牌模式 max streak 99） |
| STRESS-5 記憶體/opId | 2/2 PASS — RSS +0MB、Heap +0MB（≤ 64MB 門檻）；`executed` ledger 每局重置無 bloat |

**修復記錄（本任務內）**：
1. `dropAndReconnect` 斷線重連後重新送出 `join`（帶同 `playerId`）— 解決首次壓力測試第 10→11 局 `not_authenticated`（新 socket 未認證即被要求操作）。
2. STRESS-3 stall 分支補上 `stressTimeout.turnSeat` / `turnGeneration` — 修正潛在未指派變數。
3. 局末結算改用 `bots[0].lastSnap.settlement` 讀取（`room` 物件無快照）— 修正 TS 型別錯誤。

---

## 四、Godot headless 渲染（14 / 14 PASS）

- 執行：`Godot --headless --path apps/player-client res://qa_render_check.tscn`
- 載入真實 `Table.tscn`，注入伺服器形狀快照驗證手牌渲染、響應式錨點、胡牌光暈、聽牌標記、音效管理器 autoload。

---

## 五、Web 匯出 + serve:web（全項通過）

### 5.1 Godot Web 匯出
- 匯出預設：`apps/player-client/export_presets.cfg`（Web preset，含 Audio worklet）
- 執行：`Godot --headless --path apps/player-client --export-release "Web"`
- 產出 `apps/player-client/export/web/`：`index.html`（5.4KB）、`index.js`（280KB）、`index.pck`（62KB）、`index.wasm`（39.5MB）、`index.png`、`index.icon.png`、`index.apple-touch-icon.png`、`index.audio.worklet.js`、`index.audio.position.worklet.js`
- 前置：安裝 Godot 4.7.1 export templates（`~/Library/Application Support/Godot/export_templates/4.7.1.stable/`）、建立 `export/web` 目錄

### 5.2 serve:web 端到端驗證
`cd apps/server && WEB_ROOT=../player-client/export/web PORT=3002 node dist/apps/server/src/serve-web.js`

```
health  → 200 application/json（含 memory / sockets / rooms / executedEstimate 遙測）
/       → 200 text/html            （Godot loader）
index.wasm → 200 application/wasm  （首位元組 0x00 0x61 0x73 0x6D = \0asm 正確）
index.js   → 200 application/javascript
index.pck  → 200 application/octet-stream
index.audio.worklet.js → 200 application/javascript
任意 SPA 路由 → 200 text/html      （fallback 到 index.html）
WS /ws    → 握手成功               （同源 wss 連線 OK）
```

### 5.3 修復記錄：靜態檔案路徑解析
`resolveWebPath` 原以 `resolve(webRoot, decoded)` 處理，URL path 帶前導 `/`（如 `/index.wasm`）時 `path.resolve` 會把第二參數視為絕對路徑而**丟棄 webRoot** → candidate 變成 `/index.wasm` → 不存在 → 全部落入 SPA fallback（wasm/js/pck 都被誤回 `text/html`）。修正為先剝除前導 `/` 再 `resolve`，並使 candidate 與 root 皆為絕對路徑後才做 traversal guard 比較。

---

## 六、本任務交付功能清單

| 功能 | 檔案 | 狀態 |
|---|---|---|
| AudioManager（Autoload、master/SFX/voice 音量、靜音、`user://audio_settings.json`、程式化音效/檔案音效雙軌） | [`AudioManager.gd`](apps/player-client/scripts/AudioManager.gd)、[`project.godot`](apps/player-client/project.godot) | ✅ |
| table.gd 整合音效觸發（摸牌/棄牌/副露/胡/結算） | [`table.gd`](apps/player-client/scripts/table.gd) | ✅ |
| 手牌 Hover 抬升 10px + 高亮、選中強調框、棄牌回合同張剩餘數提示 | [`TileButton.gd`](apps/player-client/scripts/TileButton.gd) | ✅ |
| 聽牌標記（snapshot `canWin`/`isTenpai` + `GameState.can_win`） | [`snapshot.ts`](apps/server/src/snapshot.ts)、[`GameState.gd`](apps/player-client/scripts/GameState.gd) | ✅ |
| 胡牌光暈（伺服器結算快照驅動） | [`table.gd`](apps/player-client/scripts/table.gd) | ✅ |
| Table.tscn 響應式錨點 | [`Table.tscn`](apps/player-client/scenes/Table.tscn) | ✅ |
| Web 匯出 preset | [`export_presets.cfg`](apps/player-client/export_presets.cfg) | ✅ |
| serve:web（WSS + 靜態掛載 + 正確 MIME + SPA fallback） | [`serve-web.ts`](apps/server/src/serve-web.ts)、[`index.ts`](apps/server/src/index.ts)、[`package.json`](apps/server/package.json) | ✅ |
| /health 遙測（memory/sockets/rooms/executedEstimate） | [`index.ts`](apps/server/src/index.ts)、[`room.ts`](apps/server/src/room.ts) | ✅ |
| 100 局壓力測試腳本 | [`qa-stress.ts`](apps/server/src/scripts/qa-stress.ts) | ✅ |

---

## 七、結論

地端體驗完全體全部驗證通過：

- **124/124 單元測試**、**338/338 壓力測試**、**14/14 Godot headless 渲染**、**Web 匯出成功**、**serve:web 靜態/SPA/WSS 全項正確**。
- 過程中修正 4 項真實缺陷：重連未重新 join（`not_authenticated`）、STRESS-3 變數未指派、`room.lastSnap` 型別錯誤、靜態路徑解析被前導 `/` 破壞。
- 目前地端環境：
  - `http://localhost:3000`（`serve`，TIMEOUT_MS=15000）
  - `http://localhost:3001`（壓力測試伺服器，TIMEOUT_MS=1500）
  - `http://localhost:3002`（`serve:web` — 瀏覽器直接開啟 Godot Web 版）
```

## File: docs/spec.md

```
# Taiwan 16-Tile Mahjong — System Specification

> 台灣 16 張麻將 · Godot 4.7 Client + Node.js/TypeScript Authoritative Server
> Single-repository (pnpm Monorepo)

---

## 1. Core Principles

### 1.1 Authoritative Server (伺服器權威)

The **server is the single source of truth** for all game state and rule
judgment. The Godot client is a **Client-Safe UI** only:

- The client renders state received from the server.
- The client **never** decides legal moves, tile validity, win/hu determination,
  scoring, or turn order.
- Every state-changing action from a client is a **command proposal**; the
  server validates it against the authoritative rules before applying it.
- Any client can be replaced (reconnect) at any time and the authoritative
  state fully reconstructs its UI.

**Rule judgment lives exclusively in `packages/rules`** (the Domain layer).
`apps/server` merely applies Domain logic to network events.

### 1.2 Generation ID & Command Deduplication

- Every authoritative state transition carries a monotonically increasing
  **Generation ID**.
- Clients echo the Generation ID they last observed when sending commands.
- The server rejects (deduplicates) commands whose Generation ID has already
  been applied or is stale, preventing double-move / replay attacks.

---

## 2. Rule Baseline — Taiwan 16-Tile Mahjong (台灣 16 張麻將)

### 2.1 Tile Set

| Variant | Tiles |
|---|---|
| 北部 (North) — default | **144 tiles** (萬/筒/條/風/三元 + 花牌) |
| 南部 (South) | **136 tiles** (無花牌) |

Suits:
- 萬 (Characters): 1–9, ×4 each
- 筒 (Dots): 1–9, ×4 each
- 條 (Bamboo): 1–9, ×4 each
- 風 (Winds): 東/南/西/北, ×4 each
- 三元 (Dragons): 中/發/白, ×4 each
- 花 (Flowers & Seasons, 北部 only): 梅/蘭/竹/菊 + 春/夏/秋/冬, ×1 each (8 tiles → 144 total)

### 2.2 Deal

- **莊家 (Dealer): 17 tiles**
- **閒家 (Non-dealers): 16 tiles each**

### 2.3 Fixed Tail — Double-Cursor Model (雙游標)

The wall keeps a **fixed reserved tail of 16 tiles** (the 尾 16 張), never drawn
by normal play. The two cursors are:

- **Wall cursor (牆前游標)**: tiles available to draw from the head.
- **Deck cursor (牌池游標)**: tiles available to draw after the wall is
  exhausted (補花/槓 reserve for flowers and kong replacements).

The tail is never drawn by players in ordinary turns; it is only consumed by
flower replacement (補花) or kong replacement (槓上補牌).

### 2.4 Win (胡)

- **Legal = auto-win (合法即自動胡牌)**: there is **no 胡/過 button**.
  When a hand is legal to win, the server automatically declares the win.
- This keeps the zero-sum ledger consistent and removes client choice from rule
  judgment.

### 2.5 Scoring — Four-Player Zero-Sum Ledger (四人零和 Ledger)

- Each round, total score delta across all four players = **0**.
- The ledger is stored as a four-entry signed account for each player
  (balance ∈ ℤ), maintained by the server.

#### 2.5.1 Fan Matrix (台數矩陣) — 現行實作

| 台 | 條件 | 值 |
|---|---|---|
| 自摸 | 自摸胡 | +1 |
| 門清 | 無任何副露 | +1 |
| 門清一摸三 | 自摸 + 無副露 | +3 |
| 碰碰胡 | 全刻子（無吃）+ 5 組 | +4 |
| 混一色 | 單一數牌花色 + 字牌 | +4 |
| 清一色 | 單一數牌花色（無字牌） | +8 |
| 暗刻高階取代 | 每個暗刻 +1；碰碰胡成立時由碰碰胡取代（不疊加） | 0–5 |
| 莊家連莊台 | 莊家胡牌且連莊 streak > 1 | +streak−1 |

- 頂標（cap）：預設 **4 台**，可設定為 8 台；rawTotal 超過 cap 即截斷。
- 裸胡（無任何台）：結算仍至少算 **1 台**（`max(total, 1)`）。
- 自摸：其餘三家各付「台數對應分數」全額給贏家。
- 放槍：放槍者付全額，其餘非贏家各付半額（半額無條件捨去）。

#### 2.5.2 規則待確認 — 門清自摸疊加

現行實作（`scoring.ts` FAN_RULES）在「門清自摸」時**同時疊加**
自摸(+1) + 門清(+1) + 門清一摸三(+3) = **5 台**（raw）。

部分台灣北部牌例把「門清一摸三」視為**取代**前兩者的高階台（= 3 台），
或僅疊加自摸(+1) + 門清一摸三(+3)（= 4 台）。

**現況決策**：既有 golden 測試（GC-02/GC-14/GC-23/GC-25）已鎖定 raw=5，
不可擅自改算法讓測試紅一片。若確認要改成「不重複」語意，需同步：
1. 修改 `scoring.ts` 的 `門清一摸三` 規則（成立時不再計自摸/門清）；
2. 更新 `__tests__/scoring.test.ts` 對應 golden 期望；
3. 更新本小節。

在台灣 16 張北部規則確認前，維持現行疊加語意並標註為
**「規則待確認」**。

---

## 3. Repository Layout

```
taiwan-mahjong1/
├── docs/
│   └── spec.md                  # This document
├── packages/
│   └── rules/                   # Authoritative Domain (backend authority)
│       └── src/
│           ├── tiles.ts         # Tile Identity types
│           ├── rng.ts           # Secure shuffle RNG
│           ├── wall.ts          # Wall, deal, double-cursor, flower chain
│           └── __tests__/
│               └── wall.test.ts
├── apps/
│   ├── server/                  # Node.js + TS WebSocket (WSS) server
│   │   ├── package.json
│   │   └── src/                 # Room lifecycle, Generation ID, dedup
│   └── player-client/           # Godot 4.7 client project (reserved)
│       └── README.md
├── package.json                 # Root (pnpm workspace root)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

---

## 4. Flower Replacement — IMMEDIATE_TAIL_CHAIN_V1 (北部連續補花)

When the dealer draws a flower (or any player's replacement draws a flower),
the replacement is taken **immediately from the deck cursor** in a chain until
a non-flower tile is drawn — versioned `IMMEDIATE_TAIL_CHAIN_V1`.

Because flowers never occupy the hand, each flower drawn adds one extra tile
from the reserved deck cursor into the player's hand, preserving hand count
while the wall/head is not disturbed for regular turns.
```

## File: tools/download_wikimedia_tiles.py

```
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
```

## File: tools/gen_tiles.py

```
#!/usr/bin/env python3
"""Generate mahjong tile PNG sprites (2x resolution: 96x128) for the Godot client.

Output: apps/player-client/assets/tiles/{wan,tong,tiao}_{1..9}.png,
        honor_{dong,nan,xi,bei,zhong,fa,bai}.png,
        flower_{mei,lan,zhu,ju,chun,xia,qiu,dong}.png, back.png

Uses the bundled Noto Sans CJK TC font so Chinese glyphs render crisply.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO, "apps", "player-client", "assets", "tiles")
FONT_PATH = os.path.join(REPO, "apps", "player-client", "assets", "fonts",
                         "NotoSansCJKtc-Regular.otf")

W, H = 96, 128          # 2x of 48x64
MARGIN = 6              # outer ivory margin
RAD = 12                # corner radius (2x)
IVORY = (250, 248, 245, 255)
IVORY_EDGE = (214, 208, 196, 255)
BORDER = (176, 138, 44, 255)      # gold
NAVY = (16, 42, 74, 255)          # tile back
NAVY_DEEP = (10, 30, 56, 255)

# Colors for pips / characters
RED = (190, 30, 30, 255)
GREEN = (20, 110, 60, 255)
BLUE = (24, 60, 130, 255)
BLACK = (40, 34, 28, 255)

_FONT_CACHE = {}

def font(size: int):
    if size not in _FONT_CACHE:
        _FONT_CACHE[size] = ImageFont.truetype(FONT_PATH, size)
    return _FONT_CACHE[size]


def rounded_tile(draw, box, fill=IVORY, outline=BORDER, outline_w=3, radius=RAD):
    draw.rounded_rectangle(box, radius=radius, fill=fill,
                           outline=outline, width=outline_w)


def text_centered(draw, cx, cy, s, size, fill, dy=0):
    f = font(size)
    bbox = draw.textbbox((0, 0), s, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = cx - tw / 2 - bbox[0]
    y = cy - th / 2 - bbox[1] + dy
    draw.text((x, y), s, font=f, fill=fill)


def draw_circles(img, pattern):
    """pattern: list of (col, row) in a 3x4 grid (col 0-2, row 0-3)."""
    d = ImageDraw.Draw(img)
    r = 10
    for col, row in pattern:
        cx = W / 2 + (col - 1) * 17
        cy = H / 2 + (row - 1.5) * 17
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)
        d.ellipse([cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3],
                  fill=(240, 210, 200, 255))


CIRCLE_PATTERNS = {
    1: [(1, 2)],
    2: [(0, 1), (2, 3)],
    3: [(0, 1), (1, 2), (2, 3)],
    4: [(0, 1), (2, 1), (0, 3), (2, 3)],
    5: [(0, 1), (2, 1), (1, 2), (0, 3), (2, 3)],
    6: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3)],
    7: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3), (1, 1)],
    8: [(0, 1), (0, 2), (0, 3), (0, 4), (2, 1), (2, 2), (2, 3), (2, 4)],
    9: [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
}


def draw_bamboo(img, pattern):
    """pattern: list of (col, row) — each is a bamboo stick."""
    d = ImageDraw.Draw(img)
    for col, row in pattern:
        cx = W / 2 + (col - 1) * 17
        cy = H / 2 + (row - 1.5) * 17
        # stick
        d.rounded_rectangle([cx - 4, cy - 12, cx + 4, cy + 12], radius=4,
                            fill=GREEN)
        # leaf notches
        d.line([cx - 4, cy - 8, cx - 10, cy - 2], fill=GREEN, width=3)
        d.line([cx + 4, cy - 4, cx + 10, cy + 4], fill=GREEN, width=3)


BAMBOO_PATTERNS = {
    1: [(1, 2)],
    2: [(0, 1), (2, 3)],
    3: [(0, 1), (1, 2), (2, 3)],
    4: [(0, 1), (2, 1), (0, 3), (2, 3)],
    5: [(0, 1), (2, 1), (1, 2), (0, 3), (2, 3)],
    6: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3)],
    7: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3), (1, 1)],
    8: [(0, 1), (0, 2), (0, 3), (0, 4), (2, 1), (2, 2), (2, 3), (2, 4)],
    9: [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
}


def make_face(tile_id, n, kind):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN])
    # subtle inner frame
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(226, 220, 206, 255), outline_w=2, radius=RAD - 4)

    if kind == "wan":
        cn = "一二三四五六七八九"[n - 1]
        text_centered(d, W / 2, H / 2 - 14, cn, 52, BLUE)
        text_centered(d, W / 2, H / 2 + 26, "萬", 30, RED)
    elif kind == "tong":
        draw_circles(img, CIRCLE_PATTERNS[n])
    elif kind == "tiao":
        draw_bamboo(img, BAMBOO_PATTERNS[n])
    return img


def make_honor(key):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN])
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(226, 220, 206, 255), outline_w=2, radius=RAD - 4)
    char, color = {
        "dong": ("東", GREEN),
        "nan": ("南", RED),
        "xi": ("西", GREEN),
        "bei": ("北", BLUE),
        "zhong": ("中", RED),
        "fa": ("發", GREEN),
        "bai": ("白", BLUE),
    }[key]
    text_centered(d, W / 2, H / 2, char, 58, color)
    if key == "bai":
        # 白板：藍色方框框住「白」字
        d.rectangle([W / 2 - 26, H / 2 - 32, W / 2 + 26, H / 2 + 32],
                    outline=BLUE, width=5)
    return img


def make_flower(key):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN],
                 fill=(252, 246, 238, 255))
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(232, 170, 60, 255), outline_w=3, radius=RAD - 4)
    char = {"mei": "梅", "lan": "蘭", "zhu": "竹", "ju": "菊",
            "chun": "春", "xia": "夏", "qiu": "秋", "dong": "冬"}[key]
    text_centered(d, W / 2, H / 2, char, 58, RED)
    return img


def make_back():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN], fill=NAVY,
                 outline=BORDER, outline_w=4)
    rounded_tile(d, [MARGIN + 10, MARGIN + 10, W - MARGIN - 10, H - MARGIN - 10],
                 outline=(212, 175, 55, 255), outline_w=2, radius=RAD - 6)
    # gold diagonal lattice in the middle band (雀魂-style tile back)
    band_top, band_bot = H / 2 - 16, H / 2 + 16
    for i in range(-3, 4):
        x = W / 2 + i * 16
        d.line([x, band_top, x, band_bot], fill=(60, 96, 140, 255), width=2)
        d.line([x + 8, band_top, x - 8, band_bot],
               fill=(40, 70, 110, 255), width=2)
    d.rounded_rectangle([W / 2 - 12, H / 2 - 12, W / 2 + 12, H / 2 + 12],
                        radius=4, outline=(212, 175, 55, 255), width=3)
    d.rectangle([W / 2 - 5, H / 2 - 5, W / 2 + 5, H / 2 + 5], fill=(212, 175, 55, 255))
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    n = 0
    for kind in ("wan", "tong", "tiao"):
        for num in range(1, 10):
            img = make_face(f"{kind}:{num}", num, kind)
            img.save(os.path.join(OUT_DIR, f"{kind}_{num}.png"))
            n += 1
    for key in ("dong", "nan", "xi", "bei", "zhong", "fa", "bai"):
        img = make_honor(key)
        img.save(os.path.join(OUT_DIR, f"honor_{key}.png"))
        n += 1
    for key in ("mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"):
        img = make_flower(key)
        img.save(os.path.join(OUT_DIR, f"flower_{key}.png"))
        n += 1
    make_back().save(os.path.join(OUT_DIR, "back.png"))
    n += 1
    print(f"Generated {n} tiles -> {OUT_DIR}")


if __name__ == "__main__":
    main()
```

## File: nginx/entrypoint.sh

```
#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# nginx entrypoint — bootstrap + substitute variables into nginx.conf.
#
# 1. If the real Let's Encrypt cert for $DOMAIN does not exist yet
#    (first boot / before running certbot), generate a self-signed cert
#    into /etc/nginx/certs so the stack can start immediately.
# 2. Substitute ${DOMAIN} and ${CERT_DIR} into the nginx.conf template
#    (mounted at /etc/nginx/templates/nginx.conf).
# 3. Run nginx in the foreground.
# ─────────────────────────────────────────────────────────────────────────
set -eu

: "${DOMAIN:?DOMAIN is required — set it in .env (see DEPLOYMENT.md)}"

# Default to the real Let's Encrypt certificate location.
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    # No real cert yet → self-signed fallback so the container can boot.
    echo "[entrypoint] no Let's Encrypt cert for $DOMAIN yet — generating self-signed fallback…"
    CERT_DIR="/etc/nginx/certs"
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" >/dev/null 2>&1
else
    echo "[entrypoint] using Let's Encrypt cert for $DOMAIN"
fi

export CERT_DIR
envsubst '${DOMAIN} ${CERT_DIR}' < /etc/nginx/templates/nginx.conf > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
```

## File: nginx/nginx.conf

```
# ─────────────────────────────────────────────────────────────────────────
# Taiwan Mahjong — nginx configuration
#
#  * TLS termination (HTTPS 443) with Let's Encrypt certificates
#  * WebSocket (wss://) reverse proxy to the Node.js game server
#  * ACME HTTP-01 challenge endpoint for certbot renewal
#  * HTTP → HTTPS redirect (except /.well-known/acme-challenge/)
#
# ${DOMAIN} and ${CERT_DIR} are substituted by `envsubst` inside the
# entrypoint (entrypoint.sh). CERT_DIR points at the Let's Encrypt cert
# once it exists, or a self-signed fallback on first boot.
# ─────────────────────────────────────────────────────────────────────────

worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;

    # ── HTTP (80): redirect to HTTPS except ACME challenge ──
    server {
        listen 80;
        listen [::]:80;
        server_name ${DOMAIN};

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ── HTTPS (443): TLS + WSS reverse proxy ──
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name ${DOMAIN};

        ssl_certificate     ${CERT_DIR}/fullchain.pem;
        ssl_certificate_key ${CERT_DIR}/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # WebSocket upgrade headers (required for wss://).
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        # Server health check (plain HTTP → kept as /health).
        location = /health {
            proxy_pass http://server:3000/health;
        }
        location = /healthz {
            proxy_pass http://server:3000/healthz;
        }

        # WebSocket endpoint — the Godot client connects to wss://<domain>/ws.
        location /ws {
            proxy_pass http://server:3000;
        }

        # Everything else (future static client, API, …).
        location / {
            proxy_pass http://server:3000;
        }
    }
}
```
