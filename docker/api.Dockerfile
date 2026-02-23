FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/tdm ./packages/tdm
COPY packages/watcher ./packages/watcher
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@thirdwatch/api...

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=builder /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
