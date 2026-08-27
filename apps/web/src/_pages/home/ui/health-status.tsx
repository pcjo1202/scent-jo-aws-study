'use client'

import { useEffect, useState } from 'react'

import type { HealthResponse } from '@aws-study/shared'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; health: HealthResponse }
  | { status: 'failed'; message: string }

/**
 * 브라우저에서 직접 api를 부른다 — Next를 프록시로 두지 않는 구조(docs/03 §인증)를
 * 실제로 확인하는 것이 이 컴포넌트의 목적이다. 서버 컴포넌트로 옮기면 CORS 경로가 검증되지 않는다.
 */
export function HealthStatus({ apiUrl }: { apiUrl: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        // 이 엔드포인트의 응답 형태는 api가 HealthResponse로 반환한다 (apps/api/src/app.controller.ts).
        const health = (await response.json()) as HealthResponse

        setState({ status: 'loaded', health })
      } catch (cause) {
        // 언마운트로 인한 abort — 사라진 컴포넌트에 setState하지 않는다. 삼켜도 되는 유일한 경우다.
        if (controller.signal.aborted) {
          return
        }

        setState({
          status: 'failed',
          message: cause instanceof Error ? cause.message : '알 수 없는 오류',
        })
      }
    }

    void loadHealth()

    return () => controller.abort()
  }, [apiUrl])

  if (state.status === 'loading') {
    return <p>api 상태 확인 중…</p>
  }

  if (state.status === 'failed') {
    return <p role="alert">api 호출 실패 — {state.message}</p>
  }

  return (
    <p>
      api 응답: {state.health.service} · {state.health.status} · {state.health.version}
    </p>
  )
}
