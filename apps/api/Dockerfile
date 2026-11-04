FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter api... && cd apps/api && npx prisma generate --schema prisma/schema.postgres.prisma
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma db push --schema prisma/schema.postgres.prisma --skip-generate && node --import tsx src/server.ts"]
