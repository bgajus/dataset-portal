import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load env vars (e.g. VITE_DKAN_ORIGIN)
  const env = loadEnv(mode, process.cwd(), "");

  const DKAN_ORIGIN = env.VITE_DKAN_ORIGIN || "http://dkan-local.ddev.site";

  return {
    build: {
      rollupOptions: {
        input: {
          home: resolve(__dirname, "index.html"),
          search: resolve(__dirname, "src/pages/search/index.html"),
          dataset: resolve(__dirname, "src/pages/dataset/index.html"),
          dashboard: resolve(__dirname, "src/pages/dashboard/index.html"),
          editor: resolve(__dirname, "src/pages/editor/index.html"),
          myDatasets: resolve(__dirname, "src/pages/my-datasets/index.html"),
          settings: resolve(__dirname, "src/pages/settings/index.html"),
        },
      },
    },

    /**
     * Dev server only
     * Used to proxy DKAN API requests so we avoid CORS
     */
    server: {
      proxy: {
        // Preferred prefix (explicit DKAN)
        "/dkan-api": {
          target: DKAN_ORIGIN,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/dkan-api/, ""),
        },

        // Also support direct DKAN paths if client calls /api/...
        "/api": {
          target: DKAN_ORIGIN,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
