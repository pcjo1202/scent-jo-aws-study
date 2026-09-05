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
  // await한다. `void`로 넘기면 pending 상태로 dehydrate되는데 그 promise는 실패 시 반드시
  // reject되고(`dehydratePromise`), 이 화면이 api 장애에 무엇이 될지를 그 거절에 맡기게 된다.
  // 이 라우트가 빌드에 묶이지 않는 것은 `app/page.tsx`의 `force-dynamic` 덕이지 이 await가
  // 아니다 — await로는 프리렌더 결합을 못 끊는다 (SJO-49).
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
