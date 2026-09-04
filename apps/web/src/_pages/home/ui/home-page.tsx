import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { withRelatedProject } from '@vercel/related-projects'

import { getQueryClient } from '@/shared/api/query-client'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

import { healthQuery } from '../api/health-query'

import { HealthStatus } from './health-status'

// 로컬 폴백. 배포에서는 VERCEL_RELATED_PROJECTS가 짝이 맞는 api를 가리킨다 (docs/03 §프로젝트 간 URL 연결).
const DEFAULT_API_URL = 'http://localhost:3001'

export async function HomePage() {
  // VERCEL_RELATED_PROJECTS는 NEXT_PUBLIC_이 아니라 클라이언트 번들에 들어가지 않는다.
  // 서버에서 풀어 prop으로 내린다 — 클라이언트에서 부르면 배포에서도 항상 폴백이 된다.
  const apiUrl = withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })

  const queryClient = getQueryClient()
  // await한다. `void`로 두면 pending 상태로 dehydrate되는데, react-query는 그 promise를
  // **실패 시 반드시 reject**시키므로(`dehydratePromise`) api가 5xx면 빌드가
  // `Error occurred prerendering page "/"`로 죽는다 (SJO-49). await하면 실패한 쿼리가
  // dehydrate에서 빠지고 화면은 docs/02 「API 오류의 화면 표현」의 5xx 경로로 간다.
  // 이 라우트는 정적이라 기다리는 대가는 요청마다의 TTFB가 아니라 빌드 1회다.
  await queryClient.prefetchQuery(healthQuery(apiUrl))

  return (
    // 읽기 칼럼 상한과 화면 여백은 토큰이 정한다 (DESIGN.md 「Layout」).
    // px-screen이 compact 16px / medium·expanded 24px로 알아서 갈린다.
    <main className="mx-auto flex max-w-reading flex-col gap-6 px-screen py-6">
      <h1>AWS SAA-C03 학습</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          errorMessage="api 상태를 불러오지 못했다"
          canRetry
        >
          <HealthStatus apiUrl={apiUrl} />
        </QueryBoundary>
      </HydrationBoundary>
      <ThemeToggle />
    </main>
  )
}
