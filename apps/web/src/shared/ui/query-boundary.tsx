'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

/**
 * suspense 쿼리의 로딩·오류 경계를 한 번에 세운다. 화면이 `isLoading`·`isError`를
 * 각자 분기하지 않게 하는 것이 목적이다.
 *
 * 클라이언트 컴포넌트여야 한다 — `ErrorBoundary`의 `fallbackRender`는 함수 prop이라
 * 서버 컴포넌트에서 넘길 수 없다. 서버 컴포넌트는 이 래퍼를 쓴다.
 *
 * 문구·스타일은 잠정이다. 배너 컴포넌트 규격은 SJO-18에서 정해진다.
 */
export function QueryBoundary({ pending, children }: { pending: ReactNode; children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <p role="alert">
              불러오지 못했다 — {error instanceof Error ? error.message : '알 수 없는 오류'}{' '}
              <button type="button" onClick={resetErrorBoundary}>
                다시 시도
              </button>
            </p>
          )}
        >
          <Suspense fallback={pending}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
