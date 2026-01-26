import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    cacheDir: 'node_modules/.vitest',
    fileParallelism: false
  }
});
