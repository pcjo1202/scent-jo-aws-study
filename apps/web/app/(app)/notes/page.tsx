// CDN을 읽는 화면이므로 정적 프리렌더에 두지 않는다.
//
// **빌드가 죽어서가 아니다.** 위에 `AuthGuard`(클라이언트)가 서서 초기 렌더에 children을
// 그리지 않으므로 `useSuspenseQuery`는 프리렌더에서 돌지 않고 빌드는 통과한다. 이 화면은
// 서버 prefetch도 없지만, `(app)/layout.tsx`의 manifest·index prefetch가 **이 라우트에서도
// 돌아** 정적 페이로드에 구워진다 — CDN 쿼리는 staleTime이 무한이라 브라우저가 그 빌드 시점
// manifest를 영영 다시 받지 않는다.
// **판정은 「산출물에 값이 박혔는가」로 한다** (`.claude/rules/web-state.md`, SJO-19 / SJO-49).
export const dynamic = 'force-dynamic'

export { NotesPage as default, metadata } from '@/_pages/notes/ui/notes-page'
