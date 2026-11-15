# 11Plan: Oberfläche (Vite) und Server (Node, SQLite) in einem Container.
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
# Laufzeit braucht nur die Anthropic-Bibliothek (KI-Verteilung); Version wie im Bau (package-lock.json).
COPY --from=bau /app/node_modules/@anthropic-ai/sdk/package.json /tmp/sdk.json
RUN node -e "const v=require('/tmp/sdk.json').version; require('fs').writeFileSync('package.json', JSON.stringify({type:'module',dependencies:{'@anthropic-ai/sdk':v}}))" \
 && npm install --omit=dev --no-audit --no-fund && rm /tmp/sdk.json
RUN mkdir -p /daten && chown node:node /daten
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.js"]
