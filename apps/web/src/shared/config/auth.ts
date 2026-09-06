/**
 * api가 403을 준 뒤 `/login`이 「소유자 전용」을 알리는 근거. 값을 붙이는 쪽(`api-client`)과
 * 읽는 쪽(`login-page`)이 갈리므로 여기 한 번만 둔다 — 한쪽만 바뀌면 타입도 린트도 못 잡고
 * 배너가 조용히 사라진다 (`docs/02` 「API 오류의 화면 표현」 403).
 */
export const DENIED_REASON_PARAM = 'denied'
export const OWNER_ONLY_DENIED_REASON = 'owner-only'
