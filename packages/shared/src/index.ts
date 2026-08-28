/** 문항 선택지 키. 원본 문제은행이 A~F를 쓴다 (`01-requirements.md` 「문제은행」). */
export type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** 답안을 제출한 맥락. `05-database.md`의 attempts.source와 같다. */
export type AttemptSource = 'sequential' | 'review' | 'exam'

/** GET /health — M0 배포 검증에 쓴다. */
export type HealthResponse = {
  status: 'ok'
  service: 'api'
  version: string
}
