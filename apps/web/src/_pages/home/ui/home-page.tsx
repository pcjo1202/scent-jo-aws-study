import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { withRelatedProject } from '@vercel/related-projects'

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
 * manifest·index는 여기서 받지 않는다 — `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 두고
 * 이 화면은 그 캐시를 그대로 읽는다 (`docs/02` 「정적 데이터(CDN) 실패」). 남는 경계는 이
 * 화면 고유의 api 조회(health)와 청크뿐이다.
 */
export async function HomePage() {
  const apiUrl = withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })

  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(healthQuery(apiUrl))

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
        <DataSummary />
      </HydrationBoundary>
      <ThemeToggle />
    </main>
  )
}
