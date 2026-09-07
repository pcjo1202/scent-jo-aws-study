import { Controller, Get } from '@nestjs/common'

import { CurrentUser } from '../auth/current-user.decorator'
import { StatsService } from './stats.service'

import type { AuthUser } from '../auth/supabase-jwt.guard'

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats(@CurrentUser() user: AuthUser) {
    return this.statsService.getStats(user.id)
  }
}
