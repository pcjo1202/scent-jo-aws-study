import Link from 'next/link'

import { APP_TITLE } from '@/shared/config/app'
import { AppBar } from '@/shared/ui/app-bar'
import { buttonClassName } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/**
 * 없는 경로. **새 규격을 만들지 않는다** — 앱바와 「빈 상태」(문구 한 줄 + 주 버튼 하나)를
 * 그대로 쓴다 (`DESIGN.md` 「빈 상태」). 문구는 `docs/02-features.md` 「API 오류의 화면 표현」의
 * 404 행이 쓰는 "~를 찾을 수 없다" 형태다.
 *
 * 이 화면이 필요한 이유는 대시보드가 **아직 없는 두 화면으로 링크를 걸기 때문**이다 —
 * `/notes`·`/anatomy`는 E7(SJO-25·SJO-26)에서 붙는다. Next 기본 404에는 앱바도 복귀 링크도
 * 없는데, 이 앱은 주소창도 브라우저 뒤로가기도 없는 웹뷰에서 열리므로 그 화면에 닿으면
 * 빠져나올 방법이 사라진다 (`shared/ui/app-bar.tsx` 「뒤로가기는 히스토리가 아니라 라우트가
 * 정하는 고정 링크다」).
 *
 * 라우트 그룹 `(app)` 밖이라 `AuthGuard`·`CatalogGate`를 타지 않는다. 없는 경로는 세션과
 * 상관없이 없다.
 */
export default function NotFound() {
  return (
    <>
      <AppBar title={APP_TITLE} backHref="/" />
      <div className="app-bar-gutter-top flex min-h-dvh flex-col">
        <EmptyState
          message="화면을 찾을 수 없다"
          actions={
            <Link href="/" className={buttonClassName('filled')}>
              대시보드로
            </Link>
          }
        />
      </div>
    </>
  )
}
