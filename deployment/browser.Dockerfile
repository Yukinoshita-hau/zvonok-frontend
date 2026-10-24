FROM node:24-bookworm AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci --ignore-scripts
COPY tsconfig*.json ./
COPY packages packages
COPY apps apps
COPY scripts scripts
COPY session/fixture.html session/fixture.html
RUN npm run build

FROM build AS api
RUN mkdir -p /control && chown 1000:1000 /control && chmod 700 /control
USER 1000:1000
CMD ["node", "apps/api/dist/index.js"]

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS worker
USER root
COPY --from=build /usr/local/bin/node /usr/local/bin/node24
WORKDIR /app
RUN sed -i -e s@http://azure.archive.ubuntu.com@https://archive.ubuntu.com@g -e s@http://security.ubuntu.com@https://security.ubuntu.com@g /etc/apt/sources.list.d/ubuntu.sources && apt-get -o Acquire::Retries=2 update && apt-get install -y --no-install-recommends ffmpeg x11-utils xdotool pulseaudio pulseaudio-utils && rm -rf /var/lib/apt/lists/* && mkdir /control && chown 1000:1000 /control && chmod 700 /control
COPY --from=build --chown=1000:1000 /app /app
USER 1000:1000
CMD ["node24", "apps/worker/dist/index.js"]

FROM node:24-bookworm AS proxy
COPY infra/proxy*.mjs /
USER 1000:1000
CMD ["node", "/proxy.mjs"]

FROM alpine:3.22 AS guard
RUN apk add --no-cache iptables
ENTRYPOINT ["sh", "/guard-local.sh"]

FROM node:24-bookworm-slim AS media
WORKDIR /media
COPY media/package*.json ./
RUN npm ci
COPY media/*.mjs ./
COPY session/*.mjs ./
RUN cp broker.mjs session-broker.mjs && cp rtc-relay.mjs session-relay.mjs && mkdir /frames /auth /binding && chown 1000:1000 /frames /auth /binding && chmod 700 /frames /auth /binding
USER 1000:1000
CMD ["node", "publisher-supervisor.mjs"]
