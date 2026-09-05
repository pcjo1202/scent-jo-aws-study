import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Manifest } from '@aws-study/shared'

import { cdnKeys, chunkPath, chunkQuery, manifestQuery, questionIndexQuery } from './cdn'

const ROOT = 'https://cdn.example/aws-saa/prefix'
const MANIFEST: Manifest = {
  version: 'v1',
  generatedAt: '2026-09-03T17:19:57.030Z',
  // 루트와 **다른** 값이다. 아래 테스트가 두 경로를 헷갈리지 않는지 보는 근거다.
  base: `${ROOT}/v1`,
  questions: { total: 1019, chunkSize: 100, chunks: 11 },
  files: {},
}

/**
 * `queryFn`이 읽는 것은 `signal`뿐이라 나머지 컨텍스트 없이 부를 수 있다.
 * `async`인 이유: 환경변수 검사는 동기로 던지는데 Query는 그것도 거절로 취급하므로
 * 테스트에서도 같은 형태로 받는다.
 */
async function runQueryFn<T>(options: { queryFn?: unknown }): Promise<T> {
  const queryFn = options.queryFn as (context: { signal: AbortSignal }) => Promise<T>

  return queryFn({ signal: new AbortController().signal })
}

function stubFetch(response: { ok: boolean; status: number; body?: unknown }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  }))
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_DATA_BASE_URL', ROOT)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('chunkPath', () => {
  it('manifest의 files 키와 같은 3자리 0채움 형태다', () => {
    expect(chunkPath(1)).toBe('questions/chunk-001.json')
    expect(chunkPath(11)).toBe('questions/chunk-011.json')
  })
})

describe('경로 조립', () => {
  it('manifest는 버전 없는 루트에서 받는다', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: MANIFEST })

    await runQueryFn(manifestQuery())

    expect(fetchMock).toHaveBeenCalledWith(`${ROOT}/manifest.json`, expect.anything())
  })

  it('index는 루트가 아니라 manifest.base에서 받는다', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { entries: [] } })

    await runQueryFn(questionIndexQuery(MANIFEST))

    expect(fetchMock).toHaveBeenCalledWith(`${ROOT}/v1/questions/index.json`, expect.anything())
  })

  it('chunk도 manifest.base에서 받는다', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { chunk: 2 } })

    await runQueryFn(chunkQuery(MANIFEST, 2))

    expect(fetchMock).toHaveBeenCalledWith(`${ROOT}/v1/questions/chunk-002.json`, expect.anything())
  })
})

describe('실패', () => {
  it('non-ok 응답은 상태 코드와 함께 던진다 — 조용히 undefined를 흘리지 않는다', async () => {
    stubFetch({ ok: false, status: 503 })

    await expect(runQueryFn(manifestQuery())).rejects.toThrow('503')
  })

  it('NEXT_PUBLIC_DATA_BASE_URL이 없으면 fetch 전에 던진다', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_BASE_URL', '')
    const fetchMock = stubFetch({ ok: true, status: 200, body: MANIFEST })

    await expect(runQueryFn(manifestQuery())).rejects.toThrow('NEXT_PUBLIC_DATA_BASE_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('캐시 키', () => {
  it('버전이 다르면 다른 키다 — 옛 버전의 index가 새 버전에 재사용되지 않는다', () => {
    expect(cdnKeys.index('v1')).not.toEqual(cdnKeys.index('v2'))
    expect(cdnKeys.chunk('v1', 3)).not.toEqual(cdnKeys.chunk('v2', 3))
  })
})
