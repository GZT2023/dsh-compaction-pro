import { defineConfig } from 'vitest/config'

// dsh-compaction-pro ships ESM (`"type": "module"`) and its sources use
// NodeNext-style `.js` specifiers that resolve to `.ts` files. Vite's resolver
// maps `.js` -> `.ts` automatically; we pin the extensions so neither the
// test files nor the source imports surprise the loader.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    extensions: ['.ts', '.mjs', '.js', '.json'],
  },
})
