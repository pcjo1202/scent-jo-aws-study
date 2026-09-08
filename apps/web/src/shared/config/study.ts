/**
 * `/study`의 서비스 딥링크. 만드는 쪽(`/notes`)과 읽는 쪽(`toInitialFilter`)이 다른 파일이라
 * 파라미터 이름이 여기 한 번만 있다 (`.claude/rules/code-conventions.md` 「SSOT」).
 *
 * **URL에 싣는 필터는 이것 하나다.** 「필터 모드를 저장하지 않는다」(`docs/02` 「필터」)와
 * 어긋나지 않는다 — 저 결정이 기각한 것은 `localStorage`·서버 저장이고 링크는 저장이 아니다.
 * 네 필터 전부를 URL로 열지 않은 이유는 지금 그것을 만드는 화면이 `/notes` 하나뿐이기
 * 때문이다. 늘어나면 그때 이 파일이 늘어난다.
 */
export const STUDY_SERVICE_PARAM = 'service'

export function studyServiceHref(service: string) {
  return `/study?${STUDY_SERVICE_PARAM}=${encodeURIComponent(service)}`
}
