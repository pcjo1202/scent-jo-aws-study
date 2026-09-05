import type { ReactNode } from 'react'

import { AuthGuard } from '@/_app/providers/auth-guard'

/**
 * 로그인 후 화면 8개가 이 그룹에 든다. `/login`은 밖이라 가드가 걸리지 않는다 —
 * 가드 안에 두면 로그인 화면이 자기 자신으로 리다이렉트한다 (`docs/02` 「인증」).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
