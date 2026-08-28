'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { getQueryClient } from '@/shared/api/query-client'

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState로 잡지 않는다 — 이 아래에서 suspend가 일어나면 React가 초기 렌더를 버리면서
  // 클라이언트까지 함께 버린다. 싱글턴을 그대로 읽는 것이 공식 권장이다.
  const queryClient = getQueryClient()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
