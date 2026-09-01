import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'

import { JwksService } from './jwks.service'
import { SupabaseJwtGuard } from './supabase-jwt.guard'

/**
 * 가드는 전역이고 예외만 `@Public()`이다. 엔드포인트마다 붙이면 붙이는 걸 잊어서 뚫린다
 * (docs/05 「Nest 모듈 구성」).
 */
@Module({
  providers: [JwksService, { provide: APP_GUARD, useClass: SupabaseJwtGuard }],
})
export class AuthModule {}
