import { queryOptions } from '@tanstack/react-query'

import type { HealthResponse } from '@aws-study/shared'

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
 */
export function healthQuery(apiUrl: string) {
  return queryOptions({
    queryKey: healthKeys.byApiUrl(apiUrl),
    queryFn: async ({ signal }): Promise<HealthResponse> => {
      const response = await fetch(`${apiUrl}/health`, { signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // 이 엔드포인트의 응답 형태는 api가 HealthResponse로 반환한다 (apps/api/src/app.controller.ts).
      return (await response.json()) as HealthResponse
    },
  })
}
