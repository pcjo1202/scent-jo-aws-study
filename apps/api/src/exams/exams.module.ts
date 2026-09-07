import { Module } from '@nestjs/common'

import { CatalogModule } from '../catalog/catalog.module'
import { ProgressModule } from '../progress/progress.module'
import { ExamsController } from './exams.controller'
import { ExamsRepository } from './exams.repository'
import { ExamsService } from './exams.service'

/**
 * 「안 푼 문항 우선」 추첨이 풀이 상태 맵을 읽는다. 그 쿼리는 `progress`가 소유하므로
 * `ProgressRepository`를 주입받는다 — `stats`가 같은 이유로 같은 형태다
 * (`apps/api/CLAUDE.md` 「도출 쿼리는 쓰는 모듈이 소유한다」).
 */
@Module({
  imports: [CatalogModule, ProgressModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamsRepository],
})
export class ExamsModule {}
