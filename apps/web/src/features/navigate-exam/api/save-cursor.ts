import type { UpdateExamRequest, UpdateExamResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * **`cursor`는 진도가 아니라 위치다** — 되돌아가면 같이 뒤로 간다 (`docs/05` 「exam_sessions」,
 * SJO-30). 이동할 때만 저장하고 답안은 `POST /attempts`가 따로 받는다: 답을 고르는 것과
 * 화면을 옮기는 것은 별개 동작이다.
 *
 * 범위는 `0`~`64`다. 마지막(65) 문항에서 「다음」이 「종료」로 바뀌므로 65번째 위치가 없고,
 * 벗어난 값은 DTO가 400으로 거른다.
 */
export function saveCursor(apiUrl: string, sessionId: string, cursor: number) {
  const request: UpdateExamRequest = { cursor }

  return apiFetch<UpdateExamResponse>(apiUrl, `/exams/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}
