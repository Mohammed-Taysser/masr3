ARG SERVICE=auth-service
ARG PORT=7000

FROM node:24-alpine AS build
ARG SERVICE
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN npx nx build ${SERVICE} --configuration=production

FROM node:24-alpine AS runtime
ARG SERVICE
ARG PORT
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${PORT}
RUN corepack enable
COPY --from=build /app/dist/apps/${SERVICE} .
RUN pnpm install --frozen-lockfile --prod
EXPOSE ${PORT}
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1
CMD ["node", "main.js"]
