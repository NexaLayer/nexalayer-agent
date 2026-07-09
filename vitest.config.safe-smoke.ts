import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/smoke-safe/**/*.test.ts'],
    environment: 'node',
  },
});
