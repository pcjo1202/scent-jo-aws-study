import { queryOptions } from '@tanstack/react-query'

import type { ProgressResponse, QuestionStatesResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * `/me/*` 조회 (`docs/05-database.md` 「API 계약」). `/study`·`/review`·`/` 대시보드가 같은
 * 데이터를 보므로 슬라이스가 아니라 여기 둔다 — 각자 정의하면 키가 갈려 캐시가 세 벌이 된다.
 *
 * `apiUrl`이 키에 드는 이유는 프리뷰마다 짝이 맞는 api가 다르기 때문이다
 * (`docs/03` 「프로젝트 간 URL 연결」).
 */
export const meKeys = {
  all: ['me'] as const,
  progress(apiUrl: string) {
    return [...meKeys.all, apiUrl, 'progress'] as const
  },
  questionStates(apiUrl: string) {
    return [...meKeys.all, apiUrl, 'question-states'] as const
  },
}

export function progressQuery(apiUrl: string) {
  return queryOptions({
    queryKey: meKeys.progress(apiUrl),
    queryFn: () => apiFetch<ProgressResponse>(apiUrl, '/me/progress'),
  })
}

export function questionStatesQuery(apiUrl: string) {
  return queryOptions({
    queryKey: meKeys.questionStates(apiUrl),
    queryFn: () => apiFetch<QuestionStatesResponse>(apiUrl, '/me/question-states'),
  })
}
