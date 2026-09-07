import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { getQueryClient } from '@/shared/api/query-client'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { CatalogGate } from '@/_app/providers/catalog-gate'
import { AuthGuard } from '@/_app/providers/auth-guard'

/**
 * 로그인 후 화면 8개가 이 그룹에 든다. `/login`은 밖이라 가드가 걸리지 않는다 —
 * 가드 안에 두면 로그인 화면이 자기 자신으로 리다이렉트한다 (`docs/02` 「인증」).
 *
 * **manifest·index 경계가 여기 있다.** 화면마다 세우면 같은 경계가 8벌이 되고, 문구도
 * 재시도 정책도 각자 갈린다 (`docs/02` 「정적 데이터(CDN) 실패」).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(manifestQuery())

  // `prefetchQuery`는 실패를 던지지 않는다. 못 받았으면 인덱스는 건너뛰고 브라우저의
  // `CatalogGate`가 다시 시도하며, 그 거절이 아래 경계에 잡힌다.
  const manifest = queryClient.getQueryData(manifestQuery().queryKey)
  if (manifest) {
    await queryClient.prefetchQuery(questionIndexQuery(manifest))
  }

  return (
    <AuthGuard>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QueryBoundary
          pending={
            <main className="mx-auto max-w-reading px-screen py-6">
              <StatusBanner kind="loading">불러오는 중…</StatusBanner>
            </main>
          }
          errorMessage="문제 데이터를 불러오지 못했다"
          canRetry
        >
          <CatalogGate>{children}</CatalogGate>
        </QueryBoundary>
      </HydrationBoundary>
    </AuthGuard>
  )
}
