import { queryOptions } from '@tanstack/react-query'

import type { ExamSessionResponse, ListExamsResponse } from '@aws-study/shared'

import { ApiError, apiFetch } from '@/shared/api/api-client'

const CLIENT_ERROR_FLOOR = 400
const SERVER_ERROR_FLOOR = 500
const MAX_RETRIES = 3

/**
 * **4xx는 다시 물어도 같은 답이다.** 기본 재시도(3회 + 백오프)를 그대로 두면 404가 화면에
 * 닿기까지 **7초 넘게** 「불러오는 중…」이다 (2026-09-08 실측) — 없는 세션을 네 번 묻고 그 사이
 * 1·2·4초를 쉰다. 5xx·네트워크는 그대로 재시도한다.
 */
function retriesServerErrorsOnly(failureCount: number, error: Error) {
  if (
    error instanceof ApiError &&
    error.status >= CLIENT_ERROR_FLOOR &&
    error.status < SERVER_ERROR_FLOOR
  ) {
    return false
  }

  return failureCount < MAX_RETRIES
}

/**
 * **세션은 서버가 단일 원본이라 캐시에 기대지 않는다** (`docs/02` 「기기 간 동기화 정책」).
 * 기본 `staleTime` 60초를 그대로 두면 PC에서 옮긴 위치가 폰에서 1분간 낡은 값으로 열린다.
 *
 * **보장 범위를 넘겨 읽지 않는다.** 이것이 막는 것은 「낡은 캐시를 신선하다고 믿는 것」이고,
 * 화면이 서버 값을 따라가는 것까지는 아니다 — `ExamSessionScreen`은 커서·답을 마운트 시점의
 * 값으로 초기화하므로, 같은 브라우저에서 `gcTime`(5분) 안에 되돌아오면 첫 렌더가 캐시 값으로
 * 서고 뒤이어 도착한 신선한 값은 버려진다. 다른 기기는 캐시가 없어 이 경로가 없다.
 */
const SERVER_OWNED = {
  staleTime: 0,
  refetchOnMount: 'always',
  retry: retriesServerErrorsOnly,
} as const

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
