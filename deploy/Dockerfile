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
# Laufzeit braucht nur zwei Bibliotheken: Anthropic (KI-Verteilung) und web-push; Versionen wie im Bau.
COPY --from=bau /app/node_modules/@anthropic-ai/sdk/package.json /tmp/sdk.json
COPY --from=bau /app/node_modules/web-push/package.json /tmp/webpush.json
RUN node -e "const a=require('/tmp/sdk.json').version, w=require('/tmp/webpush.json').version; require('fs').writeFileSync('package.json', JSON.stringify({type:'module',dependencies:{'@anthropic-ai/sdk':a,'web-push':w}}))" \
 && npm install --omit=dev --no-audit --no-fund && rm /tmp/sdk.json /tmp/webpush.json
RUN mkdir -p /daten && chown node:node /daten
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.js"]
