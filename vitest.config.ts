import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: 'node_modules/.vitest',
  plugins: [
    {
      name: 'glsl-loader',
      transform(code, id) {
        if (id.endsWith('.glsl')) {
          return `export default ${JSON.stringify(code)};`;
        }
      }
    }
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false
  }
});
