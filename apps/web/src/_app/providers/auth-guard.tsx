'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { getSupabaseClient } from '@/shared/api/supabase'
import { StatusBanner } from '@/shared/ui/status-banner'

/**
 * 로그인 후 화면 8개가 이 안에 든다. `/login`은 라우트 그룹 밖이라 걸리지 않는다.
 *
 * **`/login`으로 보내는 조건은 「세션이 없다」 하나다** (`docs/02` 「갱신 실패를 만료와
 * 네트워크로 가르는 기준」). 만료 시각을 따로 계산하지 않고 `navigator.onLine`도 보지 않는다 —
 * 클라이언트가 네트워크로 실패한 갱신에는 세션을 지우지 않으므로, 오프라인이면 세션이 남아
 * 화면에 머문다. 그게 오프라인 제출 큐(SJO-22)가 성립하는 전제다.
 *
 * `onAuthStateChange`만 쓴다. 구독 직후 `INITIAL_SESSION`이 저장된 세션(또는 `null`)과 함께
 * 오므로 첫 판정도 여기서 나오고, 이후의 로그아웃도 같은 경로로 잡힌다.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [hasSession, setHasSession] = useState<boolean>()

  useEffect(() => {
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session))

      if (!session) {
        router.replace('/login')
      }
    })

    return () => data.subscription.unsubscribe()
  }, [router])

  // 라이브 리전은 배너보다 먼저 있어야 한다 — `aria-live`가 붙은 요소는 변경 시점에 이미
  // DOM에 있어야 낭독된다. 그래서 컨테이너를 항상 렌더하고 안쪽만 교체한다
  // (`DESIGN.md` 「Components · 상태 배너」. `QueryBoundary`가 같은 형태다).
  return (
    <div aria-live="polite">
      {hasSession ? (
        <div aria-live="off">{children}</div>
      ) : (
        <main className="mx-auto max-w-reading px-screen py-6">
          <StatusBanner kind="loading">불러오는 중…</StatusBanner>
        </main>
      )}
    </div>
  )
}
