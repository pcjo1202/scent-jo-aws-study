import type { HealthResponse } from '@aws-study/shared'
import { Controller, Get } from '@nestjs/common'

import { Public } from './auth/public.decorator'

const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth(): HealthResponse {
    return { status: 'ok', service: 'api', version: VERSION }
  }
}
