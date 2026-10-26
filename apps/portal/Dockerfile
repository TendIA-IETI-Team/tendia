# Portal del aliado. Se construye desde la raíz del monorepo:
#   docker build -f apps/portal/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api... .
FROM node:22.23-alpine AS build
RUN npm i -g pnpm@9.15.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/portal/package.json apps/portal/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile --filter @tendia/portal...
COPY packages/tokens packages/tokens
COPY apps/portal apps/portal
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_STANDALONE=true NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tendia/portal build

FROM node:22.23-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/apps/portal/.next/standalone ./
COPY --from=build /repo/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=build /repo/apps/portal/public ./apps/portal/public
USER node
EXPOSE 3000
CMD ["node", "apps/portal/server.js"]
