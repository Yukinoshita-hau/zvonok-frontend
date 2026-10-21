FROM node:22.14.0-alpine AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_LIVEKIT_URL
ARG VITE_BROWSER_ACTIVITY=false
ENV VITE_BROWSER_ACTIVITY=$VITE_BROWSER_ACTIVITY
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL VITE_PRIVATE_MEDIA_STREAMING=true
RUN npm run build:web
FROM caddy:2.10.2-alpine
COPY deployment/frontend.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 3000
