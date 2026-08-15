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
