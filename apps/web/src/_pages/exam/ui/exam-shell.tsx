import type { ReactNode } from 'react'

import { AppBar } from '@/shared/ui/app-bar'

/**
 * `/exam` 계열 화면이 **본문을 못 그리는 동안** 쓰는 골격. 로딩·오류·리다이렉트 대기가 그렇다.
 *
 * 빈 화면을 남기지 않는 것이 이 부품의 존재 이유다 — `docs/02` 「공통 골격」이 로그인 후 화면
 * 아홉에 앱바를 물려주는데, `return null`로 비우면 그 순간만 앱바가 사라져 웹뷰에서는 이탈
 * 경로까지 없어진다 (`DESIGN.md` 「뒤로가기는 히스토리가 아니라 라우트가 정하는 고정 링크다」).
 *
 * 진행 숫자도 진행 바도 없다. 가리킬 대상이 없기 때문이고, 그것이 `DESIGN.md` 「빈 상태·완주에서
 * 골격은 어떻게 되나」의 규칙이다.
 */
export function ExamShell({
  title,
  backHref,
  children,
}: {
  title: string
  backHref: string
  children: ReactNode
}) {
  return (
    <>
      <AppBar title={title} backHref={backHref} />
      <div className="app-bar-gutter-top">
        <main className="mx-auto max-w-reading px-screen py-6">{children}</main>
      </div>
    </>
  )
}
