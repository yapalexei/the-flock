# --- build static bundle ---
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY .env.defaults webpack.config.js ./
COPY src ./src

# These are baked into the public JS bundle at build time (Railway passes service
# variables as build args). Mapbox "pk." tokens are public: restrict them by URL in Mapbox.
ARG SOCKET_URL
ARG MAPBOX_ACCESS_TOKEN
ARG MAPBOX_STYLE
RUN pnpm build

# --- serve it ---
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
# Railway injects PORT; the nginx image renders the template with envsubst on start.
ENV PORT=9000
EXPOSE 9000
