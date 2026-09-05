import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiFetch } from './api-client'

const { auth } = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() },
}))

vi.mock('@/shared/api/supabase', () => ({ getSupabaseClient: () => ({ auth }) }))

const API_URL = 'https://api.example'
const PATH = '/health'

function withSession(token: string | null) {
  return { data: { session: token ? { access_token: token } : null } }
}

/** 응답을 순서대로 돌려준다 — 401 뒤 재요청까지 한 케이스 안에서 보기 위해서다. */
function stubFetch(...responses: { status: number; body?: unknown }[]) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift()
    if (!next) throw new Error('예상보다 많이 호출됐다')

    return { ok: next.status < 400, status: next.status, json: async () => next.body }
  })
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function stubLocation() {
  const replace = vi.fn()
  vi.stubGlobal('window', { location: { replace } })

  return replace
}

function authHeaderOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  const [, init] = fetchMock.mock.calls[call] as unknown as [string, RequestInit]

  return (init.headers as Record<string, string>).Authorization
}

beforeEach(() => {
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('apiFetch — docs/02 「API 오류의 화면 표현」 6조건', () => {
  it('① 200 — Authorization: Bearer가 실린다', async () => {
    auth.getSession.mockResolvedValue(withSession('tok-1'))
    const fetchMock = stubFetch({ status: 200, body: { ok: true } })

    await expect(apiFetch(API_URL, PATH)).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}${PATH}`)
    expect(authHeaderOf(fetchMock, 0)).toBe('Bearer tok-1')
  })

  it('② 401 → 갱신 성공 → 새 토큰으로 재요청해 200', async () => {
    auth.getSession
      .mockResolvedValueOnce(withSession('tok-1'))
      .mockResolvedValue(withSession('tok-2'))
    const fetchMock = stubFetch({ status: 401 }, { status: 200, body: { ok: true } })

    await expect(apiFetch(API_URL, PATH)).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(authHeaderOf(fetchMock, 1)).toBe('Bearer tok-2')
  })

  it('③ 401 → 세션이 없어짐 → 재요청하지 않고 던진다. 이동은 AuthGuard 몫이다', async () => {
    auth.getSession.mockResolvedValueOnce(withSession('tok-1')).mockResolvedValue(withSession(null))
    const fetchMock = stubFetch({ status: 401 })
    const replace = stubLocation()

    await expect(apiFetch(API_URL, PATH)).rejects.toThrow(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(replace).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('④ 401 → 갱신이 네트워크로 실패, 세션은 남음 → /login으로 보내지 않는다', async () => {
    auth.getSession.mockResolvedValue(withSession('tok-1'))
    auth.refreshSession.mockRejectedValue(new TypeError('Failed to fetch'))
    const fetchMock = stubFetch({ status: 401 }, { status: 401 })
    const replace = stubLocation()

    await expect(apiFetch(API_URL, PATH)).rejects.toMatchObject({ status: 401 })
    // 세션이 남아 있으므로 재요청까지 갔다. 오프라인이면 이 실패가 큐로 간다 (SJO-22).
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(replace).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('⑤ 403 → 로그아웃하고 「소유자 전용」으로 보낸다. 재시도하지 않는다', async () => {
    auth.getSession.mockResolvedValue(withSession('tok-1'))
    const fetchMock = stubFetch({ status: 403 })
    const replace = stubLocation()

    await expect(apiFetch(API_URL, PATH)).rejects.toMatchObject({ status: 403 })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/login?denied=owner-only')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('⑥ 5xx → 로그아웃도 이동도 없다. 호출부의 큐 경로다', async () => {
    auth.getSession.mockResolvedValue(withSession('tok-1'))
    stubFetch({ status: 503 })
    const replace = stubLocation()

    await expect(apiFetch(API_URL, PATH)).rejects.toMatchObject({ status: 503 })
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })
})
