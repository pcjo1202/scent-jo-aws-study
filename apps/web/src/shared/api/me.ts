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
 * 제출 뒤에 다시 받지 않는다 (`docs/02-features.md` 「`/review` 오답 복습」).
 *
 * **포커스·재연결 재조회를 끈다.** 무효화를 안 거는 것만으로는 고정이 되지 않는다 —
 * 이 둘은 기본이 켜짐이고(`query-core`의 `shouldFetchOn`이 미지정을 참으로 읽는다),
 * 기본 `staleTime`이 60초라 해설을 읽다 탭을 옮겼다 오면 조건이 맞는다. 그때 세트가
 * **화면의 `key` 밖에서** 줄어 커서는 그대로인 채 문항만 바뀌고, 직전 채점 결과가
 * **다음 문항의 카드 위에** 그려진다.
 *
 * `staleTime: Infinity`로 막지 않는 이유는 그것이 **재진입까지 막기** 때문이다 — 다시
 * 들어올 때는 세트가 새로 고정돼야 한다.
 */
export function wrongQuestionsQuery(apiUrl: string) {
  return queryOptions({
    queryKey: meKeys.wrong(apiUrl),
    queryFn: () => apiFetch<WrongQuestionsResponse>(apiUrl, '/me/wrong'),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
