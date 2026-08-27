FROM node:22-bookworm-slim

WORKDIR /app

# Enable pnpm via Corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

# Copy workspace files
COPY . .

# Install dependencies and build monorepo
RUN pnpm install --frozen-lockfile
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
