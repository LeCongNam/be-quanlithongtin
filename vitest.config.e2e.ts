import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-db-guard.ts'],
    // Các spec dùng chung một CSDL thật nên không chạy song song giữa các file.
    fileParallelism: false,
  },
});
