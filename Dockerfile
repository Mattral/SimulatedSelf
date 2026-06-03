# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------
# Multi-stage build with persistent Bun dependency cache.
#
# Stage 1 (deps):  install ONLY from package.json + bun.lockb so
#                  the install layer is cached until the lockfile
#                  changes. Uses BuildKit cache mounts for the
#                  global Bun cache to survive across CI runs.
# Stage 2 (build): copies source and builds the Vite bundle.
# Stage 3 (runtime): hardened nginx, non-root, healthcheck.
# ---------------------------------------------------------------

# --- Stage 1: deps -----------------------------------------------------------
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

COPY package.json bun.lockb ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# --- Stage 2: build ----------------------------------------------------------
FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# --- Stage 3: runtime --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
