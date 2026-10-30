import { defineConfig } from 'vitest/config';

/** `npm run benchmark` — long-running motion benchmark, excluded from the normal test run. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/benchmark/**/*.bench.test.ts'],
    testTimeout: 60 * 60 * 1000,
  },
});
