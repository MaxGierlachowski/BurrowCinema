# BurrowCinema all in one image: web app and Auslosung API under one address.
# Required: JELLYFIN_URL. Data lives in /data, mount a volume there.

# 1. Build the web app
FROM node:24-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json components.json ./
COPY public ./public
COPY src ./src
ENV VITE_SAME_ORIGIN_API=true
RUN npm run build

# 2. Run the API and serve the built app
FROM node:24-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=web /web/dist ./public
ENV NODE_ENV=production DATA_DIR=/data PORT=8787 NODE_NO_WARNINGS=1
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://localhost:8787/api/health || exit 1
CMD ["node", "src/index.ts"]
