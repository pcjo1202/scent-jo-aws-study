import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'

import { CurrentUser } from '../auth/current-user.decorator'
import { CreateExamDto } from './dto/create-exam.dto'
import { UpdateExamDto } from './dto/update-exam.dto'
import { ExamsService } from './exams.service'

import type { AuthUser } from '../auth/supabase-jwt.guard'

/**
 * `ParseUUIDPipe`가 uuid가 아닌 `:id`를 400으로 거른다. 없으면 그 값이 쿼리까지 가서
 * Postgres 22P02로 죽어 500이 된다 — 잘못된 요청은 400이어야 한다.
 */
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExamDto) {
    return this.examsService.createExam(user.id, dto)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.examsService.listExams(user.id)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.getExam(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.updateExam(user.id, id, dto.cursor)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.deleteExam(user.id, id)
  }

  @Post(':id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.examsService.finishExam(user.id, id)
  }
}
