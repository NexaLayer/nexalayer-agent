import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/smoke/**/*.test.ts'],
    setupFiles: ['tests/smoke/vitest-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    bail: 0,
    fileParallelism: false,
    sequence: { sequential: true },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: false,
      },
    },
    reporters: ['verbose'],
  },
});
