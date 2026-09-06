import { OWNER_ONLY_DENIED_REASON } from '@/shared/config/auth'
import { StatusBanner } from '@/shared/ui/status-banner'

import { GoogleSignInButton } from './google-sign-in-button'

export const metadata = {
  title: '로그인 · AWS SAA-C03 학습',
}

/**
 * **앱바를 두지 않는 유일한 화면이다** — 비로그인 상태에서 갈 수 있는 화면이 없어 뒤로가기가
 * 가리킬 곳이 없다 (`DESIGN.md` 「공통 헤더·네비게이션」 · `docs/02` 「공통 골격」).
 *
 * 로그인 수단은 Google 하나다. 매직링크는 메일 발송 인프라가 필요해 개인 학습앱에 과하다
 * (`docs/02` 「인증」).
 */
export async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col items-center justify-center gap-6 px-screen">
      <h1 className="text-headline-small">AWS SAA-C03 학습</h1>
      {denied === OWNER_ONLY_DENIED_REASON && (
        // 재시도를 유도하지 않는다 — 액션을 주지 않는 것이 그것이다 (`docs/02`).
        <StatusBanner kind="error">소유자 전용이다. 이 계정으로는 쓸 수 없다</StatusBanner>
      )}
      <GoogleSignInButton />
    </main>
  )
}
