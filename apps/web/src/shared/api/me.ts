import { queryOptions } from '@tanstack/react-query'

import type {
  ProgressResponse,
  QuestionStatesResponse,
  WrongQuestionsResponse,
} from '@aws-study/shared'

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
  wrong(apiUrl: string) {
    return [...meKeys.all, apiUrl, 'wrong'] as const
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

/**
 * 오답 문항 id, 번호 오름차순. **`/review`의 세트가 이 응답이다** — 진입 시 고정이므로
 * 제출 뒤에 다시 받지 않는다. 「다시 풀기」만 이 키를 무효화한다
 * (`docs/02-features.md` 「`/review` 오답 복습」).
 */
export function wrongQuestionsQuery(apiUrl: string) {
  return queryOptions({
    queryKey: meKeys.wrong(apiUrl),
    queryFn: () => apiFetch<WrongQuestionsResponse>(apiUrl, '/me/wrong'),
  })
}
