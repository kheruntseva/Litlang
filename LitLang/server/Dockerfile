FROM --platform=linux/amd64 node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY knexfile.js ./
COPY src/ ./src/

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["node", "src/index.js"]
