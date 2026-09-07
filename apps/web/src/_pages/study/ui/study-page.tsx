import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { withRelatedProject } from '@vercel/related-projects'

import { getQueryClient } from '@/shared/api/query-client'
import { progressQuery, questionStatesQuery } from '@/shared/api/me'
import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { StudyScreen } from './study-screen'

const DEFAULT_API_URL = 'http://localhost:3001'

export const metadata = { title: '순차 풀이' }

/**
 * 1019문항을 순서대로 푼다 (`docs/02-features.md` 「`/study` 순차 풀이」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * **이 화면 고유의 api 조회**뿐이고, 그래서 문구도 진도 쪽이다 — 두 경계를 하나로 합치면
 * 진도 5xx가 「문제 데이터를 불러오지 못했다」로 나간다.
 *
 * 진도와 풀이 상태는 서로를 모르므로 함께 띄운다.
 */
export async function StudyPage() {
  const apiUrl = withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(progressQuery(apiUrl)),
    queryClient.prefetchQuery(questionStatesQuery(apiUrl)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={
          <>
            <AppBar title="순차 풀이" backHref="/" />
            <main className="app-bar-gutter-top mx-auto max-w-reading px-screen py-6">
              <StatusBanner kind="loading">불러오는 중…</StatusBanner>
            </main>
          </>
        }
        errorMessage="진도를 불러오지 못했다"
        canRetry
      >
        <StudyScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
