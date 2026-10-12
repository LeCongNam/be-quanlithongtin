import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // E2E ghi vào CSDL thật nên chỉ chạy qua vitest.config.e2e.ts (có guard và chạy tuần tự).
    exclude: [...configDefaults.exclude, '**/*.e2e-spec.ts'],
  },
});
