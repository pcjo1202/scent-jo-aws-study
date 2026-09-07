import type { CreateExamRequest, CreateExamResponse } from '@aws-study/shared'

import { apiFetch } from '@/shared/api/api-client'

/**
 * 진행 중 세션이 이미 있으면 **409**다. 화면이 목록으로 미리 알고 있어도 이 판정은 서버가
 * 한다 — 다른 기기에서 그 사이 세션이 생기거나 끝날 수 있다 (`docs/02` 「목록 화면」).
 */
export function createExam(apiUrl: string, request: CreateExamRequest) {
  return apiFetch<CreateExamResponse>(apiUrl, '/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}
