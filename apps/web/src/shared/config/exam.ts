/**
 * 한 세션의 문항 수. **목록 화면의 분모 전용이다** — `GET /exams`가 `questionIds`를 담지
 * 않아(`docs/05`) 화면이 스스로 알아야 하는 유일한 자리다. 세션 안(`/exam/[id]`)에서는
 * 서버가 준 `questionIds.length`를 쓰고 이 상수를 쓰지 않는다.
 *
 * api는 `catalog/grading`이 같은 값을 소유한다 — 프론트 상수와 서버 상수를 각자 두는 것이
 * 규약이다 (`.claude/rules/code-conventions.md` 「SSOT」).
 */
export const EXAM_QUESTION_COUNT = 65
