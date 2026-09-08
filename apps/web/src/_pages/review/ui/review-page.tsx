import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { resolveApiUrl } from '@/shared/config/api-url'
import { getQueryClient } from '@/shared/api/query-client'
import { wrongQuestionsQuery } from '@/shared/api/me'
import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { ReviewScreen } from './review-screen'

export const metadata = { title: '오답 복습' }

/**
 * 틀린 문제만 다시 푼다 (`docs/02-features.md` 「`/review` 오답 복습」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * **이 화면 고유의 api 조회**인 오답 목록뿐이라 문구도 그쪽이다.
 *
 * `/study`와 달리 진도 포인터를 읽지 않는다 — 세트가 `GET /me/wrong` 하나로 정해지고 시작
 * 위치는 언제나 그 처음이다. 「어디까지 봤나」를 저장하지 않는 것은 필터를 건 `/study`와 같다.
 */
export async function ReviewPage() {
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(wrongQuestionsQuery(apiUrl))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={
          <>
            <AppBar title="오답 복습" backHref="/" />
            <div className="app-bar-gutter-top">
              <main className="mx-auto max-w-reading px-screen py-6">
                <StatusBanner kind="loading">불러오는 중…</StatusBanner>
              </main>
            </div>
          </>
        }
        errorMessage="오답 목록을 불러오지 못했다"
        canRetry
      >
        <ReviewScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
