// api·CDN을 읽는 화면이므로 정적 프리렌더에 두지 않는다.
//
// **빌드가 죽어서가 아니다.** 위에 `AuthGuard`(클라이언트)가 서서 초기 렌더에 children을
// 그리지 않으므로 `useSuspenseQuery`는 프리렌더에서 돌지 않고 빌드는 통과한다. 남는 문제는
// 서버 `prefetchQuery`의 응답이 정적 페이로드에 **구워지는** 것이다 — 진도·풀이 상태가
// 빌드 시점 값으로 굳으면 다른 기기에서 열어도 그 지점부터 이어지지 않는다.
// **판정은 「산출물에 값이 박혔는가」로 한다** (`.claude/rules/web-state.md`, SJO-19 / SJO-49).
export const dynamic = 'force-dynamic'

export { StudyPage as default, metadata } from '@/_pages/study/ui/study-page'
