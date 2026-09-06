// api·CDN을 읽는 화면이므로 정적 프리렌더에 두지 않는다.
//
// **빌드가 죽어서가 아니다.** 위에 `AuthGuard`(클라이언트)가 서서 초기 렌더에 children을
// 그리지 않으므로 `useSuspenseQuery`는 프리렌더에서 돌지 않고 빌드는 통과한다. 남는 문제는
// 서버 `prefetchQuery`의 응답이 정적 페이로드에 **구워지는** 것이다 — CDN 쿼리는 staleTime이
// 무한이라 브라우저가 그 빌드 시점 manifest를 영영 다시 받지 않는다.
// 2026-09-06 실측: 빼면 `○ Static` + 산출물에 health 1파일·manifest 4파일, 붙이면 `ƒ` + 0파일
// (`.claude/rules/web-state.md`, SJO-19 / SJO-49).
export const dynamic = 'force-dynamic'

export { HomePage as default } from '@/_pages/home/ui/home-page'
