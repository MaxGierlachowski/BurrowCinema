FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production DATA_DIR=/data PORT=8787 NODE_NO_WARNINGS=1
VOLUME /data
EXPOSE 8787
CMD ["node", "src/index.ts"]
