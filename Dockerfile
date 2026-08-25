FROM node:22-alpine

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY . .

# Install dependencies and build monorepo
RUN pnpm install --frozen-lockfile
RUN pnpm build

EXPOSE 3000

ENV PORT=3000
ENV ENABLE_AI=true
ENV WEB_ROOT=/app/apps/player-client/export/web
# Durable rooms: keep SQLite outside the image so restarts survive.
ENV SQLITE_PATH=/data/server.sqlite
ENV SEAT_CREDENTIAL_SECRET=

VOLUME ["/data"]

CMD ["node", "apps/server/dist/apps/server/src/serve-web.js"]
