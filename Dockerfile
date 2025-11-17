# syntax=docker/dockerfile:1

############################
# Build stage
############################
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build (e.g. TypeScript -> dist/)
RUN npm run build


############################
# Runtime stage
############################
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled app
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/app.js"]

