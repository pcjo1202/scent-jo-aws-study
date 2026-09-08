import { queryOptions } from '@tanstack/react-query'

import type {
  ProgressResponse,
  QuestionStatesResponse,
  StatsResponse,
  WrongQuestionsResponse,
} from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * 로그인한 사용자 자신의 조회 (`docs/05-database.md` 「API 계약」). `/study`·`/review`·`/`
 * 대시보드가 같은 데이터를 보므로 슬라이스가 아니라 여기 둔다 — 각자 정의하면 키가 갈려
 * 캐시가 세 벌이 된다. **경로가 `/me/*`가 아닌 것이 하나 있다** — `/stats`도 토큰의 사용자로
 * 스코프되므로 같은 자리다.
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
  stats(apiUrl: string) {
    return [...meKeys.all, apiUrl, 'stats'] as const
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

/**
 * 카테고리별 정답률. 이름순으로 오고, **낮은 순 정렬과 안 푼 카테고리 제외는 화면이 한다**
 * (`docs/05-database.md` 「카테고리별 정답률」).
 *
 * 문항이 자기 카테고리 전부에 산입되므로 `sum(total)`은 문항 수보다 크고, 카테고리가 0개인
 * 문항은 어느 막대에도 안 든다. 둘 다 정상이라 응답에 합계가 없다.
 *
 * **마운트마다 다시 받는다.** 이 응답을 무효화하는 곳이 없기 때문이다 — 제출 지점들은
 * `meKeys.progress`·`meKeys.wrong`만 겨누고 `meKeys.all`을 쓰지 않는데, 그건 실수가 아니라
 * `questionStates`를 일부러 고정하기 위해서다 (`study-screen.tsx` 「제출 뒤 두 쿼리를 다르게
 * 다룬다」). 그래서 무효화를 넓히는 대신 이 쿼리를 신선하게 둔다: 기본 `staleTime` 60초를
 * 그대로 두면 `/study`에서 몇 문제 풀고 **뒤로가기**로 대시보드에 왔을 때 진도 카드만 갱신되고
 * 정답률 막대가 직전 값으로 남아 **한 화면이 두 시점을 말한다.**
 */
export function statsQuery(apiUrl: string) {
  return queryOptions({
    queryKey: meKeys.stats(apiUrl),
    queryFn: () => apiFetch<StatsResponse>(apiUrl, '/stats'),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
