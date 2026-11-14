import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  CLIENT_METADATA_PATH,
  createClientMetadata,
} from "./src/auth/config.ts";

export default defineConfig(() => {
  const metadata = createClientMetadata();
  return {
    plugins: [
      react(),
      {
        name: "oauth-client-metadata",
        configureServer(server) {
          server.middlewares.use(CLIENT_METADATA_PATH, (_request, response) => {
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(metadata));
          });
        },
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: CLIENT_METADATA_PATH.slice(1),
            source: JSON.stringify(metadata, null, 2),
          });
        },
      },
    ],
    server: { host: "127.0.0.1" },
  };
});
