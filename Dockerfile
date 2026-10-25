FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY frontend ./frontend
COPY migrations ./migrations
COPY tools/cloud-bootstrap.js tools/migrate.js ./tools/
COPY openapi.yaml schema.sql seed.sql ./
USER node
CMD ["node", "src/index.js"]
