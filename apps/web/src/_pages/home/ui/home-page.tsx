import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { withRelatedProject } from '@vercel/related-projects'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { getQueryClient } from '@/shared/api/query-client'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

import { healthQuery } from '../api/health-query'

import { DataSummary } from './data-summary'
import { HealthStatus } from './health-status'

const DEFAULT_API_URL = 'http://localhost:3001'

/**
 * SJO-27 대시보드가 오기 전까지 쓰는 **임시 검증 화면**이다. api 왕복과 CDN 3단(manifest →
 * index → chunk)이 실제로 도는지를 눈으로 보는 것이 목적이다.
 *
 * manifest·index 경계에 `canRetry`만 주고 다른 화면으로 넘기지 않는다 — 이 앱의 유일한 단일
 * 실패 지점이라 넘길 곳이 없다 (`docs/02` 「정적 데이터(CDN) 실패」). 이 경계를 앱 골격으로
 * 끌어올리는 것은 공통 셸이 생기는 SJO-20의 몫이다.
 */
export async function HomePage() {
  const apiUrl = withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })

  const queryClient = getQueryClient()

  // api와 manifest는 서로를 모르므로 함께 띄운다. index는 manifest의 `base`가 있어야 해서
  // 뒤로 갈 수밖에 없다 — 데이터 의존이지 워터폴 실수가 아니다.
  await Promise.all([
    queryClient.prefetchQuery(healthQuery(apiUrl)),
    queryClient.prefetchQuery(manifestQuery()),
  ])

  // `prefetchQuery`는 실패를 던지지 않는다. 못 받았으면 인덱스는 건너뛰고 브라우저의
  // `useSuspenseQuery`가 다시 시도하며, 그 거절이 아래 경계에 잡힌다.
  const manifest = queryClient.getQueryData(manifestQuery().queryKey)
  if (manifest) {
    await queryClient.prefetchQuery(questionIndexQuery(manifest))
  }

  return (
    <main className="mx-auto flex max-w-reading flex-col gap-6 px-screen py-6">
      <h1 className="text-headline-small">AWS SAA-C03 학습</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          errorMessage="api 상태를 불러오지 못했다"
          canRetry
        >
          <HealthStatus apiUrl={apiUrl} />
        </QueryBoundary>
        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          errorMessage="문제 데이터를 불러오지 못했다"
          canRetry
        >
          <DataSummary />
        </QueryBoundary>
      </HydrationBoundary>
      <ThemeToggle />
    </main>
  )
}
