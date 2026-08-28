---
paths:
  - "apps/web/**/*.{ts,tsx}"
---

# web 상태 관리 규칙

루트 `CLAUDE.md`와 `apps/web/CLAUDE.md`가 먼저 적용된다. 왜 이렇게 정했는지는 `docs/10-conventions.md` 「상태 관리」.

## 상태를 어디에 둘지 — 4단 경계

| 상태의 성격 | 도구 |
|---|---|
| RSC에서 해결되는 데이터 | Server Component에서 직접 fetch |
| 클라이언트에서 지속 동기화가 필요한 서버 데이터 | TanStack Query |
| UI 전역 상태 | Jotai |
| 컴포넌트 로컬 상태 | `useState` |

**애매하면 위쪽을 먼저 시도한다.** RSC로 되는 것을 Query로 내리지 않고, Query로 되는 것을 Jotai에 넣지 않는다.

**서버 데이터를 Jotai에 복사하지 않는다.** 캐시가 둘이 되면 동기화 버그가 생긴다. 여러 화면이 같은 데이터를 봐야 하면 각자 같은 `queryOptions`를 부른다 — Query 캐시가 이미 공유 저장소다.

**Jotai는 아직 설치돼 있지 않다.** 전역 UI 상태가 처음 필요해지는 시점에 `pnpm --filter @aws-study/web add jotai`로 추가한다. 그때도 **`Provider`는 두지 않는다** — 기본 store로 충분하고 그게 보일러플레이트가 가장 적다.

## 쿼리 정의는 슬라이스의 `api/`에 한 번만 쓴다

```ts
// src/_pages/home/api/health-query.ts
export const healthKeys = {
  all: ['health'] as const,
  byApiUrl(apiUrl: string) {
    return [...healthKeys.all, apiUrl] as const
  },
}

export function healthQuery(apiUrl: string) {
  return queryOptions({ queryKey: healthKeys.byApiUrl(apiUrl), queryFn: … })
}
```

- **`queryOptions()`로 감싼다.** `prefetchQuery`·`useSuspenseQuery`·`invalidateQueries`가 같은 객체를 그대로 받는다
- **키 문자열을 컴포넌트에 흩지 않는다.** 슬라이스당 팩토리 하나가 SSOT다. `useQuery({ queryKey: ['health'] })`처럼 배열 리터럴을 인라인하지 않는다
- 쿼리 정의를 `ui/` 안에 두지 않는다. 세그먼트는 `api/`다

## suspense가 기본이다

**`useSuspenseQuery`를 쓴다. `isLoading`·`isError`로 분기하지 않는다.**

```tsx
// ✅ 화면
const { data } = useSuspenseQuery(healthQuery(apiUrl))

// ❌
const { data, isLoading, isError } = useQuery(healthQuery(apiUrl))
if (isLoading) return <Spinner />
```

로딩·오류 경계는 `@/shared/ui/query-boundary`의 `QueryBoundary`가 세운다.

```tsx
<QueryBoundary
  pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
  errorMessage="api 상태를 불러오지 못했다"
  canRetry
>
  <HealthStatus apiUrl={apiUrl} />
</QueryBoundary>
```

- **`errorMessage`는 필수다.** 무엇을 못 불러왔는지는 화면만 안다. 「오류가 발생했습니다」로 때우지 않는다
- **오류 표현을 함수 prop으로 받지 않는다.** 화면이 대부분 서버 컴포넌트인데 함수는 그 경계를 못 넘는다 — 함수로 열면 정작 화면이 아무것도 못 정하고 기본값만 쓴다
- **액션은 `docs/02-features.md` 「API 오류의 화면 표현」이 정한다.** 403은 아무것도 넘기지 않고(재시도 유도 금지), 404는 `errorAction`에 목록 링크를, 5xx·네트워크는 `canRetry`를 준다
- 예외 문자열을 화면에 옮기지 않는다. `QueryBoundary`가 `error`를 렌더하지 않는 이유다

`useQuery`를 쓸 자리는 둘뿐이다. 그때는 이유를 주석으로 남긴다.

- **로딩 중에도 이전 데이터를 계속 보여줘야 하는 경우** (필터 전환 등) — `useSuspenseQuery`는 `placeholderData`를 받지 않는다
- **조건이 갖춰지기 전에는 돌면 안 되는 경우** — `useSuspenseQuery`는 `enabled`를 받지 않는다. `skipToken`으로도 못 피한다 (`queryFn`에서 `SkipToken`이 `Exclude`돼 있다)

둘 다 `UseSuspenseQueryOptions`가 `UseQueryOptions`에서 `queryFn`·`enabled`·`throwOnError`·`placeholderData`를 `OmitKeyof`하기 때문이다.

## 서버 컴포넌트는 prefetch로 넘긴다

```tsx
const queryClient = getQueryClient()
void queryClient.prefetchQuery(healthQuery(apiUrl))   // await하지 않는다

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <QueryBoundary pending={…}>{…}</QueryBoundary>
  </HydrationBoundary>
)
```

- **`prefetchQuery`를 `await`하지 않는다.** pending 상태로 dehydrate돼 스트리밍으로 넘어간다. `await`하면 페이지 첫 바이트가 그 요청을 기다린다
- **`QueryClient`를 `useState`나 `new QueryClient()`로 직접 만들지 않는다.** 항상 `@/shared/api/query-client`의 `getQueryClient()`를 부른다. 브라우저에서 매번 새로 만들면 suspend마다 캐시가 통째로 버려진다
- prefetch 없이 `useSuspenseQuery`만 쓰면 **서버·브라우저가 같은 요청을 두 번 돈다**

## 오프라인 제출 큐는 Query에 맡기지 않는다

답안 제출 실패의 재전송은 `docs/02-features.md` 「백엔드 요청 실패」가 정한 `localStorage` 큐 + `POST /attempts/batch`로 한다. Query의 재시도·mutation 캐시로 대신하지 않는다. Query는 **조회 캐시**를 맡는다.
