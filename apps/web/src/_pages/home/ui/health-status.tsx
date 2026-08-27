'use client'

import { useEffect, useState } from 'react'

import type { HealthResponse } from '@aws-study/shared'

// 배포에서는 VERCEL_RELATED_PROJECTS가 우선한다 (docs/06 「환경별 차이」). 이 값은 로컬 폴백이다.
const DEFAULT_API_URL = 'http://localhost:3001'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; health: HealthResponse }
  | { status: 'failed'; message: string }

/**
 * 브라우저에서 직접 api를 부른다 — Next를 프록시로 두지 않는 구조(docs/03 §인증)를
 * 실제로 확인하는 것이 이 컴포넌트의 목적이다. 서버 컴포넌트로 옮기면 CORS 경로가 검증되지 않는다.
 */
export function HealthStatus() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL

    async function loadHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        setState({ status: 'loaded', health: (await response.json()) as HealthResponse })
      } catch (cause) {
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
  }, [])

  if (state.status === 'loading') {
    return <p>api 상태 확인 중…</p>
  }

  if (state.status === 'failed') {
    return <p role="alert">api 호출 실패 — {state.message}</p>
  }

  return (
    <p>
      api 응답: {state.health.service} · {state.health.status} · v{state.health.version}
    </p>
  )
}
