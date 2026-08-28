import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // esbuild는 emitDecoratorMetadata를 지원하지 않아 Nest DI가 깨진다.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    // apps/web은 순수 로직만 여기 들어온다. 컴포넌트 렌더링은 테스트하지 않으므로
    // `.spec.tsx`를 일부러 받지 않는다 (docs/08 「안 쓰는 것」).
    include: ['apps/api/**/*.spec.ts', 'apps/web/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
