FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install

COPY backend backend
COPY frontend frontend
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist

RUN mkdir -p /data/bin /data/config /data/logs

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
