ARG NODE_VERSION=24.14.1-alpine

# ============================================
# Stage 1: Install dependencies
# ============================================

FROM node:${NODE_VERSION} AS builddeps
WORKDIR /usr/app
COPY ./package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ============================================
# Stage 1: Install production dependencies
# ============================================
FROM node:${NODE_VERSION} AS dependencies
ENV NODE_ENV=production
WORKDIR /usr/app
COPY ./package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
  
# ============================================
# Stage 2: Build Nest.js application
# ============================================

FROM node:${NODE_VERSION} AS builder
WORKDIR /usr/app
COPY --from=builddeps /usr/app/node_modules ./node_modules
COPY . .
RUN npm run build


# ============================================
# Stage 3: Run Nest.js application
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /usr/app

ENV NODE_ENV=production
COPY --from=dependencies --chown=node:node /usr/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/app/dist ./dist
USER node:1001

EXPOSE 80
CMD ["node", "dist/src/main.js"]
