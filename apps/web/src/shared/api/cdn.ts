import { queryOptions } from '@tanstack/react-query'

import type { Chunk, Manifest, QuestionIndex } from '@aws-study/shared'

import { dataBaseUrl } from '@/shared/config/env'

/** manifest의 `files` 키와 같은 형태여야 한다 — `questions/chunk-001.json` (`docs/04` 「경로 레이아웃」). */
const CHUNK_NUMBER_DIGITS = 3
const INDEX_PATH = 'questions/index.json'

/**
 * 세 쿼리 모두 **페이지 세션 동안 고정**이다. 재조회하지 않으며 새 버전은 새로고침에서만
 * 반영된다 — index와 chunk는 같은 버전 안에서만 정합하고, 세션 도중 `base`가 갈리면
 * 풀던 문항이 사라지는 경로까지 설계해야 한다 (`docs/04` 「manifest.json」, SJO-30).
 *
 * `gcTime`까지 무한인 이유: 화면이 잠깐 언마운트됐다 5분 뒤 돌아오면 manifest를 다시 받아
 * 그 사이 올라간 새 버전을 물어 온다. 그게 「세션 동안 고정」이 깨지는 유일한 경로다.
 */
const SESSION_PINNED = { staleTime: Infinity, gcTime: Infinity } as const

export const cdnKeys = {
  all: ['cdn'] as const,
  manifest() {
    return [...cdnKeys.all, 'manifest'] as const
  },
  index(version: string) {
    return [...cdnKeys.all, version, 'index'] as const
  },
  chunk(version: string, chunk: number) {
    return [...cdnKeys.all, version, 'chunk', chunk] as const
  },
}

export function chunkPath(chunk: number): string {
  return `questions/chunk-${String(chunk).padStart(CHUNK_NUMBER_DIGITS, '0')}.json`
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`CDN ${response.status}: ${url}`)
  }

  // CDN 산출물은 `data:verify`가 배포 전 전수 검증한다 (`docs/04`). 런타임에 다시 재지 않는다.
  return (await response.json()) as T
}

/** 모든 데이터 접근의 진입점. 이것이 실패하면 앱이 아무것도 하지 못한다 (`docs/02`). */
export function manifestQuery() {
  return queryOptions({
    queryKey: cdnKeys.manifest(),
    queryFn: ({ signal }) => fetchJson<Manifest>(`${dataBaseUrl()}/manifest.json`, signal),
    ...SESSION_PINNED,
  })
}

/**
 * 아래 둘은 `dataBaseUrl()`이 아니라 **manifest의 `base`** 를 쓴다. 버전 경로가 거기 있고,
 * 그래야 index와 chunk가 같은 버전에서 온 것이 보장된다.
 */
export function questionIndexQuery(manifest: Manifest) {
  return queryOptions({
    queryKey: cdnKeys.index(manifest.version),
    queryFn: ({ signal }) => fetchJson<QuestionIndex>(`${manifest.base}/${INDEX_PATH}`, signal),
    ...SESSION_PINNED,
  })
}

/**
 * 청크 번호는 `IndexEntry.chunk`에서 온다. **문항 id로 계산하지 않는다** — 청크 크기를
 * 바꿔도 안 깨지도록 인덱스가 매핑을 들고 있다 (`docs/04` 「index.json」).
 */
export function chunkQuery(manifest: Manifest, chunk: number) {
  return queryOptions({
    queryKey: cdnKeys.chunk(manifest.version, chunk),
    queryFn: ({ signal }) => fetchJson<Chunk>(`${manifest.base}/${chunkPath(chunk)}`, signal),
    ...SESSION_PINNED,
  })
}
