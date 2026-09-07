import { Controller, Get } from '@nestjs/common'

import { CurrentUser } from '../auth/current-user.decorator'
import { ProgressService } from './progress.service'

import type { AuthUser } from '../auth/supabase-jwt.guard'

@Controller('me')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('progress')
  getProgress(@CurrentUser() user: AuthUser) {
    return this.progressService.getSummary(user.id)
  }

  @Get('question-states')
  getQuestionStates(@CurrentUser() user: AuthUser) {
    return this.progressService.getQuestionStates(user.id)
  }

  @Get('wrong')
  getWrong(@CurrentUser() user: AuthUser) {
    return this.progressService.getWrongQuestions(user.id)
  }
}
