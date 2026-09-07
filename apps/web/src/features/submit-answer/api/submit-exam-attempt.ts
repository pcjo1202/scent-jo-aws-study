import type { ChoiceKey, CreateAttemptRequest, ExamAttemptResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * 모의고사의 답안 제출. **응답에 정오가 없다** — 시험 중에 정답이 새면 안 되므로 서버가
 * `{ accepted: true }`만 준다 (`docs/02` 「모드별 차이」). 그래서 이 경로는 낙관적으로
 * 진행할 수 있다: 화면이 그릴 것이 응답에 없다 (`/study`의 `submitAttempt`와 갈리는 지점).
 *
 * 답은 **고르는 즉시** 기록되고 마지막 답이 채점 대상이다 (`docs/02` 「진행」).
 */
export function submitExamAttempt(
  apiUrl: string,
  sessionId: string,
  questionId: number,
  selected: ChoiceKey[],
) {
  const request: CreateAttemptRequest = { questionId, selected, source: 'exam', sessionId }

  return apiFetch<ExamAttemptResponse>(apiUrl, '/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}
