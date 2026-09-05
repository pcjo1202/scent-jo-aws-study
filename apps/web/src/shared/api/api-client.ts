import { getSupabaseClient } from '@/shared/api/supabase'
import { DENIED_REASON_PARAM, OWNER_ONLY_DENIED_REASON } from '@/shared/config/auth'

const UNAUTHORIZED = 401
const FORBIDDEN = 403

/** 403에서 보내는 곳. 쿼리 파라미터를 `/login`이 읽어 「소유자 전용」을 알린다. */
const OWNER_ONLY_PATH = `/login?${DENIED_REASON_PARAM}=${OWNER_ONLY_DENIED_REASON}`

/** 화면이 `docs/02` 「API 오류의 화면 표현」의 행을 고를 수 있도록 상태 코드를 남긴다. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

async function currentAccessToken() {
  const { data } = await getSupabaseClient().auth.getSession()

  return data.session?.access_token
}

function send(url: string, init: RequestInit | undefined, token: string | undefined) {
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
}

/**
 * 허용되지 않은 계정. **재시도를 유도하지 않는다** — 로그아웃하고 알리는 것이 끝이다
 * (`docs/02` 「API 오류의 화면 표현」).
 *
 * 문서 내비게이션으로 나가는 이유: 로그아웃이 `SIGNED_OUT`을 쏘면 `AuthGuard`도 `/login`으로
 * 보내려 한다. 둘이 경합하면 이유 없는 `/login`이 이길 수 있는데, 전체 로드는 그 클라이언트
 * 이동을 무효로 만든다.
 */
async function denyOwnerOnly() {
  await getSupabaseClient().auth.signOut()
  window.location.replace(OWNER_ONLY_PATH)
}

/**
 * api 호출의 유일한 경로. Bearer를 자동으로 싣고 401에서 한 번 갱신한다.
 *
 * **갱신 실패를 스스로 판정하지 않는다.** 갱신을 시도한 뒤 세션이 남아 있으면 재요청하고,
 * 없으면 그대로 던진다 — 없어졌다면 클라이언트가 이미 `SIGNED_OUT`을 쐈고 `AuthGuard`가
 * `/login`으로 보낸다. 여기서 따로 이동시키지 않는 이유는 이동의 주인이 하나여야 하기
 * 때문이다 (`docs/02` 「갱신 실패를 만료와 네트워크로 가르는 기준」).
 *
 * 오프라인이면 세션이 남으므로 재요청이 다시 네트워크 오류로 실패하고, 그 오류는 호출부의
 * 큐 경로로 간다 (`docs/02` 「백엔드 요청 실패」, SJO-22).
 *
 * `apiUrl`을 인자로 받는 이유: 프리뷰가 짝이 맞는 api를 부르려면 `VERCEL_RELATED_PROJECTS`로
 * 풀어야 하는데 그것은 `NEXT_PUBLIC_`이 아니라 서버에서만 보인다 (`docs/03` 「프로젝트 간 URL
 * 연결」). 서버 컴포넌트가 풀어서 내려 준다.
 */
export async function apiFetch<T>(apiUrl: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${apiUrl}${path}`
  let response = await send(url, init, await currentAccessToken())

  if (response.status === UNAUTHORIZED) {
    // 갱신의 실패 여부를 여기서 읽지 않는다 — 바로 아래에서 세션 유무로 가르는 것이 판정이고,
    // 근거를 둘로 두면 둘이 어긋나는 경우를 또 정해야 한다 (`docs/02` 「인증」).
    await getSupabaseClient()
      .auth.refreshSession()
      .catch(() => undefined)

    const refreshedToken = await currentAccessToken()
    if (refreshedToken) {
      response = await send(url, init, refreshedToken)
    }
  }

  if (response.status === FORBIDDEN) {
    await denyOwnerOnly()
    throw new ApiError(FORBIDDEN)
  }

  if (!response.ok) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as T
}
