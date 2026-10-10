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
    // vitest 1.x's default 'threads' pool (worker_threads) wedges silently on
    // files that register/execute thousands of tests — e.g. the preset-sweep
    // files over ~7k assets. The stall signature: RUN banner prints, no test
    // ever completes, 0% CPU (vitest#3077; 'forks' became vitest 2.x's default
    // for exactly this reason). With forks, tests/presetAssets.test.ts goes
    // from never finishing to 7,141 passing in ~5s.
    pool: 'forks',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    fileParallelism: false
  }
});
