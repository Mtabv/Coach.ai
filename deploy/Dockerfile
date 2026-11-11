# Coach.AI: Oberfläche (Vite) und Server (Node, SQLite) in einem Container.
FROM node:22-slim AS bau
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:22-slim
ENV NODE_ENV=production COACHAI_DATEN=/daten COACHAI_FRONTEND=/app/dist PORT=3000
WORKDIR /app
COPY --from=bau /app/dist ./dist
COPY --from=bau /app/server/dist ./server
RUN echo '{"type":"module"}' > package.json
RUN mkdir -p /daten && chown node:node /daten
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.js"]
