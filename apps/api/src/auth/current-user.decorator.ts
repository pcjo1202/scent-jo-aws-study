import { createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest, AuthUser } from './supabase-jwt.guard'

/**
 * 전역 가드가 통과시킨 요청에만 붙어 있다. `user_id`는 항상 토큰의 `sub`이고
 * 요청 본문에서 받지 않는다 (docs/05 「API 계약」).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (request.user === undefined) {
      throw new Error('@CurrentUser()를 @Public() 라우트에서 쓸 수 없다')
    }

    return request.user
  },
)
