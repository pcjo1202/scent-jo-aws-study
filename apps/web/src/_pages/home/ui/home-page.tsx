import { ReadingColumn } from '@scent-jo/react'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examsQuery } from '@/shared/api/exams'
import { progressQuery, statsQuery } from '@/shared/api/me'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'
import { APP_TITLE } from '@/shared/config/app'
import { ScreenShell } from '@/shared/ui/screen-shell'
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
 *
 * **경계는 골격 안에 둔다.** `QueryBoundary`의 오류 배너는 `pending`과 달리 감쌀 자리를 받지
 * 않으므로, 경계가 골격 바깥이면 진도 5xx에서 앱바도 읽기 칼럼 여백도 없는 배너 한 줄만 남는다.
 *
 * **뒤로가기도 우측 액션도 진행 바도 없다.** 허브이고, 진행 바는 문제 풀이 3화면만이다
 * (`DESIGN.md` 「앱바」).
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
      <ScreenShell title={APP_TITLE}>
        <ReadingColumn className="py-4">
          <QueryBoundary
            pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
            errorMessage="진도를 불러오지 못했다"
            canRetry
          >
            <DashboardScreen apiUrl={apiUrl} />
          </QueryBoundary>
        </ReadingColumn>
      </ScreenShell>
    </HydrationBoundary>
  )
}
