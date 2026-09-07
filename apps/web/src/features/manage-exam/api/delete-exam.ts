import type { DeleteExamResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/** 포기. 세션과 그 답안이 사라진다 (`docs/02` 「세션 생성」). 종료된 세션이면 409다. */
export function deleteExam(apiUrl: string, sessionId: string) {
  return apiFetch<DeleteExamResponse>(apiUrl, `/exams/${sessionId}`, { method: 'DELETE' })
}
