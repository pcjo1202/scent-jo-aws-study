'use client'

import { useEffect, useState } from 'react'

import type { HealthResponse } from '@aws-study/shared'

// 로컬 폴백. 배포에서 NEXT_PUBLIC_API_URL이 비면 이 값이 번들에 박혀 mixed content로 막히는데,
// 화면에는 네트워크 오류로만 보인다. VERCEL_RELATED_PROJECTS로 가르는 분기는 SJO-3에서 넣는다.
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
  }, [])

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
