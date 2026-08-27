import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // esbuild는 emitDecoratorMetadata를 지원하지 않아 Nest DI가 깨진다.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['apps/api/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    // 대상 0건이면 vitest는 exit 1이다 (docs/10 「테스트」).
    passWithNoTests: true,
  },
})
