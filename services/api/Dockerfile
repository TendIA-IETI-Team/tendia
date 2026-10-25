# API de TendIA. Se construye desde la raíz del monorepo:
#   docker build -f services/api/Dockerfile .
FROM node:22.23-alpine AS build
RUN npm i -g pnpm@9.15.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter @tendia/api...
COPY services/api services/api
RUN pnpm --filter @tendia/api build && pnpm --filter @tendia/api deploy --prod /out \
    && cp -r services/api/dist services/api/prisma /out/ \
    && cd /out && npx prisma@6.1.0 generate

FROM node:22.23-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
USER node
EXPOSE 4000
# Aplica migraciones pendientes y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
