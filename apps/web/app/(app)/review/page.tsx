// api·CDN을 읽는 화면이므로 정적 프리렌더에 두지 않는다. 근거는 `/study`와 같다 — 서버
// `prefetchQuery`의 응답이 정적 페이로드에 **구워지면** 오답 세트가 빌드 시점 값으로 굳어,
// 다른 기기에서 열어도 그때의 오답 목록이 나온다.
// **판정은 「산출물에 값이 박혔는가」로 한다** (`.claude/rules/web-state.md`, SJO-19 / SJO-49).
export const dynamic = 'force-dynamic'

export { ReviewPage as default, metadata } from '@/_pages/review/ui/review-page'
