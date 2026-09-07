'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { ApiError } from '@/shared/api/api-client'
import { AppBar } from '@/shared/ui/app-bar'
import { Button, buttonClassName } from '@/shared/ui/button'
import { StatusBanner } from '@/shared/ui/status-banner'

const NOT_FOUND = 404

/**
 * 세션 조회의 로딩·오류 경계. **404와 나머지를 가른다** — `docs/02` 「API 오류의 화면 표현」이
 * 404에는 목록 복귀를, 5xx·네트워크에는 재시도를 요구하는데 `QueryBoundary`는 한 화면이 한 벌을
 * 미리 고르는 그릇이라 이 분기를 담지 못한다 (그 컴포넌트 주석의 「천장」).
 *
 * **없는 세션과 남의 세션이 둘 다 404다** — api가 존재 여부를 흘리지 않으므로(`docs/05`)
 * 화면도 둘을 가르지 않는다. 문구는 하나다.
 *
 * 세션을 못 받은 상태의 앱바에는 진행 숫자도 진행 바도 없다. 가리킬 대상이 없기 때문이고,
 * 그것이 `DESIGN.md` 「빈 상태·완주에서 골격은 어떻게 되나」의 규칙이다. 라이브 리전은 배너보다
 * 먼저 있어야 하므로 바깥 컨테이너를 항상 그린다.
 */
export function ExamSessionBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <div aria-live="polite">
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ error, resetErrorBoundary }) => (
              <Shell>
                {error instanceof ApiError && error.status === NOT_FOUND ? (
                  <StatusBanner
                    kind="error"
                    action={
                      <Link href="/exam" className={buttonClassName()}>
                        모의고사 목록
                      </Link>
                    }
                  >
                    세션을 찾을 수 없다
                  </StatusBanner>
                ) : (
                  <StatusBanner
                    kind="error"
                    action={<Button onClick={resetErrorBoundary}>다시 시도</Button>}
                  >
                    모의고사를 불러오지 못했다
                  </StatusBanner>
                )}
              </Shell>
            )}
          >
            <Suspense
              fallback={
                <Shell>
                  <StatusBanner kind="loading">불러오는 중…</StatusBanner>
                </Shell>
              }
            >
              <div aria-live="off">{children}</div>
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </QueryErrorResetBoundary>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppBar title="모의고사" backHref="/exam" />
      <main className="app-bar-gutter-top mx-auto max-w-reading px-screen py-6">{children}</main>
    </>
  )
}
