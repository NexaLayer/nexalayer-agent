import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/regression/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['verbose'],
  },
});
