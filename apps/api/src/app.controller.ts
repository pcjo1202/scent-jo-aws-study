import type { HealthResponse } from '@aws-study/shared'
import { Controller, Get } from '@nestjs/common'

// Vercel이 주입한다 (docs/06 「전체 목록」). 로컬에는 없으므로 'dev'.
// package.json의 version은 쓰지 않는다 — private·0.0.0 고정이라 배포를 구분하지 못하고,
// import하면 rootDir이 올라가 산출물이 dist/src/로 밀린다.
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthResponse {
    return { status: 'ok', service: 'api', version: VERSION }
  }
}
