'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import { healthQuery } from '../api/health-query'

/**
 * 브라우저가 api를 직접 부르는 구조(docs/03 §인증 — Next를 프록시로 두지 않는다)를
 * 실제로 확인하는 것이 이 컴포넌트의 목적이다. 첫 렌더는 서버 prefetch가 채우므로,
 * CORS 경로는 캐시가 만료된 뒤 클라이언트 refetch에서 밟힌다.
 */
export function HealthStatus({ apiUrl }: { apiUrl: string }) {
  const { data: health } = useSuspenseQuery(healthQuery(apiUrl))

  return (
    <p>
      api 응답: {health.service} · {health.status} · {health.version}
    </p>
  )
}
