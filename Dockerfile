# --- Stage 1: build with Bun -------------------------------------------------
FROM oven/bun:1.1-alpine AS build
WORKDIR /app

# Install with frozen lockfile for reproducible builds.
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Stage 2: serve with nginx ----------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Drop default config; install hardened one with gzip + long-term caching.
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/app.conf

# Non-root user (nginx alpine ships with `nginx` user already).
COPY --from=build /app/dist /usr/share/nginx/html

# Security headers, healthcheck.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
