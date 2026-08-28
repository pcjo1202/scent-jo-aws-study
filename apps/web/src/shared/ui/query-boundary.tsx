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
 * **오류 표현을 함수 prop으로 열지 않는다.** 이 앱의 화면은 대부분 서버 컴포넌트인데
 * 함수는 그 경계를 못 넘으므로, 함수로 열면 정작 화면 쪽에서 아무것도 못 정하고 기본값만
 * 쓰게 된다. 대신 직렬화되는 조각으로 받는다.
 *
 * - `errorMessage` **필수** — 무엇을 못 불러왔는지는 화면만 안다 (`DESIGN.md` 「상태 배너」)
 * - `errorAction` 없음 = 액션 없음. 403이 이 경우다 — 재시도를 유도하지 않는다
 * - `canRetry` — 「다시 시도」를 붙인다. `reset`을 쥔 것이 이 컴포넌트뿐이라 따로 받는다
 *
 * 404의 「목록으로 복귀」는 `errorAction`에 링크를 넘겨 만든다
 * (`docs/02-features.md` 「API 오류의 화면 표현」).
 *
 * 천장: **응답 코드에 따라 표현을 바꾸지는 못한다.** 화면이 한 벌을 미리 고른다. 한 경계에서
 * 403과 404를 갈라야 하는 화면이 생기면 그 화면이 클라이언트 컴포넌트로 감싸고 직접 분기한다.
 */
export function QueryBoundary({
  pending,
  errorMessage,
  errorAction,
  canRetry = false,
  children,
}: {
  pending: ReactNode
  errorMessage: ReactNode
  errorAction?: ReactNode
  canRetry?: boolean
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
            fallbackRender={({ resetErrorBoundary }) => (
              // `error`를 쓰지 않는다. `Failed to fetch` 같은 기술 문자열은 사용자가 할 수
              // 있는 일을 알려주지 않는다.
              <StatusBanner
                kind="error"
                action={
                  <>
                    {errorAction}
                    {canRetry && <Button onClick={resetErrorBoundary}>다시 시도</Button>}
                  </>
                }
              >
                {errorMessage}
              </StatusBanner>
            )}
          >
            {/*
              내용은 리전 밖으로 뺀다. 리전이 배너만 낭독해야 하는데 여기 두면 suspense가
              풀릴 때 지문·선택지·해설 전문이 통째로 polite 큐에 들어간다. 삽입된 노드의
              낭독 여부는 그 노드 자신의 `aria-live`가 정하므로 `off`면 조용하다.
            */}
            <Suspense fallback={pending}>
              <div aria-live="off">{children}</div>
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </QueryErrorResetBoundary>
  )
}
