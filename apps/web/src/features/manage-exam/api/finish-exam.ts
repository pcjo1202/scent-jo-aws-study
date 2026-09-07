import type { FinishExamResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * 채점은 서버가 한다 — 미응답은 오답이고 분모는 언제나 65다 (`docs/02` 「종료 / 결과」).
 * 이미 종료된 세션이면 409, `content_version`이 갈렸으면 역시 409다 (SJO-24가 그 화면을 맡는다).
 */
export function finishExam(apiUrl: string, sessionId: string) {
  return apiFetch<FinishExamResponse>(apiUrl, `/exams/${sessionId}/finish`, { method: 'POST' })
}
