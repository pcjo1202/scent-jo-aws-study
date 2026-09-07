import { queryOptions } from '@tanstack/react-query'

import type { ExamSessionResponse, ListExamsResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * **세션은 서버가 단일 원본이라 캐시에 기대지 않는다** (`docs/02` 「기기 간 동기화 정책」).
 * 기본 `staleTime` 60초를 그대로 두면 PC에서 옮긴 위치가 폰에서 1분간 낡은 값으로 열리고,
 * 그게 이 이슈의 완료 정의(「PC에서 시작해 폰에서 이어서 완료」)다.
 *
 * `gcTime`은 건드리지 않는다 — 0으로 두면 suspense가 매 렌더 캐시를 버려 재조회가 돈다.
 * 낡은 값을 안 쓰는 것과 캐시를 안 두는 것은 다른 이야기다.
 */
const SERVER_OWNED = { staleTime: 0, refetchOnMount: 'always' } as const

export const examKeys = {
  all: ['exams'] as const,
  list(apiUrl: string) {
    return [...examKeys.all, apiUrl, 'list'] as const
  },
  detail(apiUrl: string, sessionId: string) {
    return [...examKeys.all, apiUrl, 'detail', sessionId] as const
  },
}

export function examsQuery(apiUrl: string) {
  return queryOptions({
    queryKey: examKeys.list(apiUrl),
    queryFn: () => apiFetch<ListExamsResponse>(apiUrl, '/exams'),
    ...SERVER_OWNED,
  })
}

/** 없거나 남의 세션이면 404다 — 403이 아니다 (`docs/05` 「오류 응답」). 화면이 그 코드로 분기한다. */
export function examQuery(apiUrl: string, sessionId: string) {
  return queryOptions({
    queryKey: examKeys.detail(apiUrl, sessionId),
    queryFn: () => apiFetch<ExamSessionResponse>(apiUrl, `/exams/${sessionId}`),
    ...SERVER_OWNED,
  })
}
