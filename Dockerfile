FROM node:22-bookworm-slim

WORKDIR /app

# Install native build dependencies for better-sqlite3 / node-gyp
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install pnpm globally via npm for 100% reliability
RUN npm install -g pnpm@latest

# Copy all files
COPY . .

# Install and build
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
