import { defaultShouldDehydrateQuery, environmentManager, QueryClient } from '@tanstack/react-query'

// 하이드레이션 직후 같은 데이터를 곧바로 다시 받지 않을 만큼의 최소 신선도.
const DEFAULT_STALE_TIME_MS = 60_000

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: DEFAULT_STALE_TIME_MS },
      dehydrate: {
        // 아직 pending인 쿼리까지 실어 보낸다. 서버 컴포넌트가 prefetch를 await하지 않고
        // 스트리밍으로 넘길 수 있다 — 없으면 화면 전체가 첫 요청이 끝날 때까지 막힌다.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * 서버는 요청마다 새 클라이언트를, 브라우저는 싱글턴을 쓴다.
 * 브라우저에서 매번 새로 만들면 렌더가 suspend될 때마다 캐시가 통째로 버려진다.
 *
 * `_app`이 아니라 `shared`에 둔다 — 프로바이더뿐 아니라 `_pages`의 서버 컴포넌트도
 * prefetch를 위해 부르는데, FSD 경계상 `_pages`는 `_app`을 가져올 수 없다.
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()

  return browserQueryClient
}
