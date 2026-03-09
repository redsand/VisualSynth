import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: 'node_modules/.vitest',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false
  }
});
