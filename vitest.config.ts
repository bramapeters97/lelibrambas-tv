import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/android/**', '**/ios/**'],
    coverage: { reporter: ['text', 'html'] },
  },
});
