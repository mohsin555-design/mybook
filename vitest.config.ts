import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})
