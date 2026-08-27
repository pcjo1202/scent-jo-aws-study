import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // NestJS 데코레이터를 변환한다. esbuild는 emitDecoratorMetadata를 지원하지 않아 DI가 깨진다.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['apps/api/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    // 치명 영역(파서·채점·가드)이 아직 없어 대상이 0건이다. vitest는 0건을 exit 1로 취급한다.
    passWithNoTests: true,
  },
})
