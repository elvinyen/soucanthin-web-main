import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'server.ts',
    outDir: 'server',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: {
      output: {
        entryFileNames: 'index.mjs',
      },
    },
  },
});
