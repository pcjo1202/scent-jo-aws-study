import { Module } from '@nestjs/common'

import { CatalogModule } from '../catalog/catalog.module'
import { ProgressModule } from '../progress/progress.module'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

/**
 * 풀이 상태 맵은 `progress`가 소유한다 (`apps/api/CLAUDE.md` 「도출 쿼리는 쓰는 모듈이
 * 소유한다」). 여기서 같은 쿼리를 다시 쓰면 「미완료 exam 세션 제외」가 두 벌이 된다.
 */
@Module({
  imports: [CatalogModule, ProgressModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
