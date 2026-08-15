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
