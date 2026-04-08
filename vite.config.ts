import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "web",
  publicDir: "public",
  build: {
    outDir: "../dist-web",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@model": path.resolve(__dirname, "src")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/feed": "http://127.0.0.1:3001"
    },
    fs: {
      // Custom allow replaces Vite defaults; include repo root + web + model src.
      allow: [
        __dirname,
        path.resolve(__dirname, "web"),
        path.resolve(__dirname, "src")
      ]
    }
  }
});
