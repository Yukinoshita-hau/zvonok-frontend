FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:8080/api
ARG VITE_WS_URL=ws://localhost:8080/api/ws-raw
ARG VITE_LIVEKIT_URL=ws://localhost:7880
ARG VITE_PRIVATE_MEDIA_STREAMING=false
ARG VITE_BROWSER_ACTIVITY=false

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL
ENV VITE_PRIVATE_MEDIA_STREAMING=$VITE_PRIVATE_MEDIA_STREAMING
ENV VITE_BROWSER_ACTIVITY=$VITE_BROWSER_ACTIVITY

RUN npm run build:web


FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
