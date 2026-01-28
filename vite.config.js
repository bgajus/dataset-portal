import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        search: resolve(__dirname, 'src/pages/search/index.html'),
        dataset: resolve(__dirname, 'src/pages/dataset/index.html'),
        dashboard: resolve(__dirname, 'src/pages/dashboard/index.html'),
        editor: resolve(__dirname, 'src/pages/editor/index.html'),
        myDatasets: resolve(__dirname, 'src/pages/my-datasets/index.html'),
        settings: resolve(__dirname, 'src/pages/settings/index.html'),
        notifications: resolve(__dirname, 'src/pages/notifications/index.html'),
        curation: resolve(__dirname, 'src/pages/curation/index.html'),
      },
    },
  },
})
