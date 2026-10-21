import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  plugins: [
    react(),
    {
      name: "settings-fixture-history",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (
            request.headers.accept?.includes("text/html") &&
            !request.url?.split("?")[0].includes(".")
          )
            request.url = "/artifacts/stages/settings-shell-fixture.html";
          next();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
  resolve: {
    alias: [
      {
        find: /.*\/ActiveCallOverlay\/ActiveCallOverlay$/,
        replacement: local("./fixtureMedia.tsx"),
      },
      {
        find: /.*\/CallOverlay\/CallOverlay$/,
        replacement: local("./fixtureMedia.tsx"),
      },
      {
        find: /.*\/CallRestoreBootstrap\/CallRestoreBootstrap$/,
        replacement: local("./fixtureMedia.tsx"),
      },
      {
        find: /.*\/DesktopNotificationBridge\/DesktopNotificationBridge$/,
        replacement: local("./fixtureMedia.tsx"),
      },
      {
        find: /.*\/middlewares\/websocket\.middleware$/,
        replacement: local("./fixtureMiddleware.ts"),
      },
    ],
  },
});
