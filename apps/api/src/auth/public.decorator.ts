import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/** 전역 가드(`SupabaseJwtGuard`)의 예외 표시. 현재 붙는 곳은 `GET /health` 하나뿐이다. */
export function Public() {
  return SetMetadata(IS_PUBLIC_KEY, true)
}
