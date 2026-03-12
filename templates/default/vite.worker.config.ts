import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import path from "path";

// Production build config - targets Cloudflare Workers
export default defineConfig({
  plugins: [
    // File swapping plugin: redirect Node.js-specific files to Worker equivalents
    {
      name: "shopify-server-redirect",
      enforce: "pre",
      resolveId(source) {
        if (source.endsWith("/shopify.server")) {
          return path.resolve("./app/shopify.server.worker.ts");
        }
        if (source.endsWith("/entry.server")) {
          return path.resolve("./app/entry.server.worker.tsx");
        }
        return null;
      },
    },
    reactRouter(),
  ],
  ssr: {
    resolve: {
      conditions: ["workerd", "worker", "browser"],
    },
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
  },
  build: {
    minify: true,
    ssr: true,
    rollupOptions: {
      input: "./app/entry.server.worker.tsx",
      output: {
        dir: "build/server",
        format: "esm",
        entryFileNames: "index.js",
      },
    },
  },
});
