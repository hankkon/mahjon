FROM node:22-bookworm-slim

WORKDIR /app

# Install native build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install pnpm pinned to exact packageManager version
RUN npm install -g pnpm@11.21.0

# Copy workspace configuration and sources
COPY . .

# Install dependencies and build
RUN pnpm install
RUN pnpm build

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV ENABLE_AI=true
ENV WEB_ROOT=/app/apps/player-client/export/web
ENV SQLITE_PATH=/data/server.sqlite
ENV SEAT_CREDENTIAL_SECRET=

VOLUME ["/data"]

CMD ["node", "apps/server/dist/apps/server/src/serve-web.js"]
