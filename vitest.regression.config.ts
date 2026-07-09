import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/regression/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    bail: 0,
    fileParallelism: false,
    reporters: ['verbose'],
  },
});
