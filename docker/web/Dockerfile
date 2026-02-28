FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install

COPY backend backend
COPY frontend frontend
ARG BUILD_COMMIT=unknown
RUN BUILD_COMMIT_VALUE="$BUILD_COMMIT" && \
    if [ "$BUILD_COMMIT_VALUE" = "unknown" ] && git rev-parse --short HEAD >/dev/null 2>&1; then BUILD_COMMIT_VALUE="$(git rev-parse --short HEAD)"; fi && \
    echo "$BUILD_COMMIT_VALUE" > /app/.build-commit && \
    date -u +"%Y-%m-%dT%H:%M:%SZ" > /app/.build-time
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/.build-commit ./.build-commit
COPY --from=build /app/.build-time ./.build-time

RUN mkdir -p /data/bin /data/config /data/logs

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
