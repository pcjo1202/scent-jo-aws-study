import { queryOptions } from '@tanstack/react-query'

import type { HealthResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/** 이 슬라이스 queryKey의 SSOT. 컴포넌트가 키 배열을 직접 쓰지 않는다. */
export const healthKeys = {
  all: ['health'] as const,
  byApiUrl(apiUrl: string) {
    return [...healthKeys.all, apiUrl] as const
  },
}

/**
 * 정의는 여기 한 번뿐이다 — prefetchQuery·useSuspenseQuery·invalidateQueries가
 * 모두 이 객체를 그대로 받는다. 키와 queryFn이 호출부마다 갈리지 않는다.
 *
 * `/health`는 `@Public()`이라 토큰이 없어도 200이지만 `apiFetch`로 부른다. api를 부르는
 * 경로가 하나여야 Bearer 주입·401 갱신·403 처리가 화면마다 갈리지 않는다. 서버 prefetch
 * 에서는 세션이 없어 헤더가 붙지 않고, 브라우저 refetch에서 붙는다.
 */
export function healthQuery(apiUrl: string) {
  return queryOptions({
    queryKey: healthKeys.byApiUrl(apiUrl),
    queryFn: () => apiFetch<HealthResponse>(apiUrl, '/health'),
  })
}
