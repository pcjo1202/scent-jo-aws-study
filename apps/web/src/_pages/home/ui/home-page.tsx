import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examsQuery } from '@/shared/api/exams'
import { progressQuery, statsQuery } from '@/shared/api/me'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'
import { APP_TITLE } from '@/shared/config/app'
import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { DashboardScreen } from './dashboard-screen'

/**
 * 허브 (`docs/02-features.md` 「`/` 대시보드」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * 이 화면 고유의 api 조회뿐이고, 그래서 문구도 진도 쪽이다 — 두 경계를 합치면 진도 5xx가
 * 「문제 데이터를 불러오지 못했다」로 나간다.
 *
 * **여기 걸리는 것은 진도 하나다.** 정답률과 모의고사는 `DashboardScreen`이 안쪽 경계로
 * 내렸다 (`dashboard-screen.tsx`). prefetch는 셋 다 여기서 병렬로 띄운다 — 경계가 어디
 * 서는지와 서버가 무엇을 미리 받는지는 별개다.
 */
export async function HomePage() {
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(progressQuery(apiUrl)),
    queryClient.prefetchQuery(examsQuery(apiUrl)),
    queryClient.prefetchQuery(statsQuery(apiUrl)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={
          <>
            <AppBar title={APP_TITLE} />
            <div className="app-bar-gutter-top">
              <main className="mx-auto max-w-reading px-screen py-6">
                <StatusBanner kind="loading">불러오는 중…</StatusBanner>
              </main>
            </div>
          </>
        }
        errorMessage="진도를 불러오지 못했다"
        canRetry
      >
        <DashboardScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
