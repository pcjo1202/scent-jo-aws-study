/**
 * 한 세션의 문항 수. **목록 화면의 분모 전용이다** — `GET /exams`가 `questionIds`를 담지
 * 않아(`docs/05`) 화면이 스스로 알아야 하는 유일한 자리다. 세션 안(`/exam/[id]`)에서는
 * 서버가 준 `questionIds.length`를 쓰고 이 상수를 쓰지 않는다.
 *
 * api는 `catalog/grading`이 같은 값을 소유한다 — 프론트 상수와 서버 상수를 각자 두는 것이
 * 규약이다 (`.claude/rules/code-conventions.md` 「SSOT」).
 */
export const EXAM_QUESTION_COUNT = 65

/**
 * `/exam` 계열 경로. 리터럴을 화면마다 조립하지 않는다 — 결과 두 화면이 붙으면서 같은 문자열이
 * 여섯 파일에 흩어졌다 (`.claude/rules/code-conventions.md` 「SSOT」).
 *
 * `position`은 세션 안의 **1-based 위치**이지 문항 id도 `cursor`도 아니다 (`docs/02` 「결과
 * 화면의 구성」).
 */
export function examSessionHref(sessionId: string) {
  return `/exam/${sessionId}`
}

export function examResultHref(sessionId: string) {
  return `/exam/${sessionId}/result`
}

export function examReviewHref(sessionId: string, position: number) {
  return `/exam/${sessionId}/result/${String(position)}`
}
