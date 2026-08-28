'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { Button } from '@/shared/ui/button'
import { StatusBanner } from '@/shared/ui/status-banner'

/**
 * suspense 쿼리의 로딩·오류 경계를 한 번에 세운다. 화면이 `isLoading`·`isError`를
 * 각자 분기하지 않게 하는 것이 목적이다.
 *
 * 클라이언트 컴포넌트여야 한다 — `ErrorBoundary`의 `fallbackRender`는 함수 prop이라
 * 서버 컴포넌트에서 넘길 수 없다. 서버 컴포넌트는 이 래퍼를 쓴다.
 *
 * `fallback`은 `error`를 받는다. 상태 코드로 갈라야 하는 화면이 있기 때문이다
 * (`docs/02-features.md` 「API 오류의 화면 표현」) — 403은 재시도를 유도하지 않고 404는
 * 목록으로 돌려보낸다. **받은 `error`를 화면에 렌더하지 않는다.** `Failed to fetch` 같은
 * 기술 문자열은 사용자가 할 수 있는 일을 알려주지 않는다.
 */
export function QueryBoundary({
  pending,
  fallback,
  children,
}: {
  pending: ReactNode
  fallback?: (props: { error: unknown; reset: () => void }) => ReactNode
  children: ReactNode
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        // 라이브 리전을 항상 렌더한다 — `aria-live`는 변경 시점에 이미 DOM에 있어야 낭독되는데,
        // 배너는 상태가 바뀌는 그 순간 마운트되므로 배너에 달면 늦다
        // (DESIGN.md 「상태 배너 · 라이브 리전은 배너보다 먼저 있어야 한다」).
        <div aria-live="polite">
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ error, resetErrorBoundary }) =>
              fallback ? (
                fallback({ error, reset: resetErrorBoundary })
              ) : (
                <StatusBanner
                  kind="error"
                  action={<Button onClick={resetErrorBoundary}>다시 시도</Button>}
                >
                  불러오지 못했다
                </StatusBanner>
              )
            }
          >
            <Suspense fallback={pending}>{children}</Suspense>
          </ErrorBoundary>
        </div>
      )}
    </QueryErrorResetBoundary>
  )
}
