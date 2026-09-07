'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'

/**
 * manifest와 index가 손에 들어오기 전에는 화면을 그리지 않는다. **이 앱의 유일한 단일 실패
 * 지점이라 다른 화면으로 넘길 곳이 없고**, 인덱스 없이 성립하는 화면도 없다
 * (`docs/02-features.md` 「정적 데이터(CDN) 실패」).
 *
 * 화면마다 이 경계를 다시 세우지 않으려고 골격으로 올렸다. **화면이 자기 api 데이터에 세우는
 * 경계는 이것보다 안쪽이라 먼저 잡는다** — 그래서 여기 걸리는 것은 manifest·index뿐이다.
 * 그 구분이 없으면 진도 조회 5xx가 「문제 데이터를 불러오지 못했다」로 나간다.
 *
 * `children`을 그대로 돌려주므로 서버 컴포넌트를 자식으로 받을 수 있다 — 클라이언트 경계는
 * 여기서 끝난다.
 */
export function CatalogGate({ children }: { children: ReactNode }) {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  useSuspenseQuery(questionIndexQuery(manifest))

  return children
}
