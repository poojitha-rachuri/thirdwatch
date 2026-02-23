FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/tdm ./packages/tdm
COPY packages/watcher ./packages/watcher
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@thirdwatch/worker...

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=builder /app /app
CMD ["node", "apps/worker/dist/index.js"]
