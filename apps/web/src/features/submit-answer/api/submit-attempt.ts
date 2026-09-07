import type { AttemptResponse, CreateAttemptRequest } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * 답안 제출 (`docs/05-database.md` 「POST /attempts」). **정오는 서버가 정한다** — 화면이
 * 보낸 판정을 믿지 않으므로 응답의 `isCorrect`·`answer`가 채점 결과의 유일한 출처다
 * (루트 `CLAUDE.md`).
 *
 * 즉시 채점 모드라 낙관적으로 진행할 수 없다 — 화면에 그릴 정답이 이 응답에만 있다.
 * `docs/02-features.md` 「백엔드 요청 실패」의 낙관적 UI·큐는 정오를 숨기는 `/exam`과
 * 재전송 경로(SJO-22)의 이야기다.
 */
export function submitAttempt(apiUrl: string, request: CreateAttemptRequest) {
  return apiFetch<AttemptResponse>(apiUrl, '/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}
