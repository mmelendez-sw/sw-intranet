import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'web',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          exclude: ['server/dist/**', 'node_modules/**'],
          environment: 'node',
        },
      },
    ],
  },
});
