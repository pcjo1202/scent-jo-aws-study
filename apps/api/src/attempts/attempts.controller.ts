import { Body, Controller, Post } from '@nestjs/common'

import { CurrentUser } from '../auth/current-user.decorator'
import { AttemptsService } from './attempts.service'
import { CreateAttemptDto } from './dto/create-attempt.dto'

import type { AuthUser } from '../auth/supabase-jwt.guard'

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttemptDto) {
    return this.attemptsService.createAttempt(user.id, dto)
  }
}
