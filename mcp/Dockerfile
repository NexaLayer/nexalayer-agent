FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node --from=builder /app/dist ./dist
RUN npm ci --omit=dev && npm cache clean --force

USER node
ENTRYPOINT ["node", "dist/index.js"]
