FROM node:22.23.2-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

ARG APP_ORIGIN
ENV APP_ORIGIN=${APP_ORIGIN} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev

FROM base AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=file:/app/data/alfred.db \
    DATA_DIRECTORY=/app/data \
    CLOUD_AI_ENABLED=true

WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "--import", "tsx", "scripts/start-production.ts"]
