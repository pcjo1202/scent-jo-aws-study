import type { HealthResponse } from '@aws-study/shared'
import { Controller, Get } from '@nestjs/common'

import { version } from '../package.json'

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthResponse {
    return { status: 'ok', service: 'api', version }
  }
}
