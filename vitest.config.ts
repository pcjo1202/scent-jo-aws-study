import { fileURLToPath } from 'node:url'

import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    // `apps/web/tsconfig.json`의 유일한 별칭. 없으면 web의 spec이 세그먼트를 넘는 import를
    // 못 푼다 (`apps/web/CLAUDE.md` 「경로 별칭은 `@/` 하나뿐이다」). api는 별칭을 쓰지 않는다.
    alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
})
