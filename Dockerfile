FROM oven/bun:1-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS runtime
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json drizzle.config.ts ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY drizzle/ ./drizzle/
USER bun
EXPOSE 3002
ENV PORT=3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:3002/health/live || exit 1
CMD ["bun", "run", "src/index.ts"]
