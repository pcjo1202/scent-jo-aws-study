import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { ConfigService } from '@nestjs/config'
import { ServiceUnavailableException } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { CatalogService } from './catalog.service'

const MANIFEST_CHECK_INTERVAL_MS = 5 * 60 * 1000
/** 루프백 왕복보다 넉넉하다. 이 시간 안에 요청이 없으면 부팅 로드가 없는 것이다. */
const BOOT_FETCH_GRACE_MS = 100

let server: Server
let rootUrl: string
let counts: Record<string, number>
let liveVersion: 'v1' | 'v2'
let isFailing: boolean
let isVersionless: boolean

function toIndex(answer: string) {
  return {
    entries: [{ id: 1, chunk: 1, categories: [], services: [], answer: [answer], choiceCount: 4 }],
  }
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? ''
    counts[path] = (counts[path] ?? 0) + 1

    if (isFailing) {
      response.writeHead(503).end()
      return
    }

    const body =
      path === '/manifest.json'
        ? {
            ...(isVersionless ? {} : { version: liveVersion }),
            generatedAt: '',
            base: `${rootUrl}/${liveVersion}`,
            questions: {},
            files: {},
          }
        : toIndex(path === '/v1/questions/index.json' ? 'A' : 'B')

    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  rootUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

beforeEach(() => {
  counts = {}
  liveVersion = 'v1'
  isFailing = false
  isVersionless = false
  // Date만 가짜로 둔다 — fetch와 AbortSignal.timeout이 진짜 타이머를 쓴다
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function createService() {
  return new CatalogService(new ConfigService({ DATA_BASE_URL: rootUrl }))
}

it('① 생성자는 네트워크를 타지 않는다 — 빈 캐시로 기동한다', async () => {
  createService()

  // 실제 왕복보다 길게 기다린다 — 부팅 로드가 await 없이 떠 있으면 한 틱으로는 못 본다
  await new Promise((resolve) => setTimeout(resolve, BOOT_FETCH_GRACE_MS))

  expect(counts).toEqual({})
})

it('② 첫 접근에 manifest·인덱스를 각 한 번 받는다', async () => {
  const entry = await createService().getEntry(1)

  expect(counts['/manifest.json']).toBe(1)
  expect(counts['/v1/questions/index.json']).toBe(1)
  expect(entry?.answer).toEqual(['A'])
})

it('③ 5분 안의 재접근은 manifest를 다시 보지 않는다', async () => {
  const service = createService()
  await service.getEntry(1)

  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS - 1)
  await service.getEntry(1)

  expect(counts['/manifest.json']).toBe(1)
})

it('④ 5분이 지나면 manifest를 다시 보되 버전이 같으면 인덱스는 안 받는다', async () => {
  const service = createService()
  await service.getEntry(1)

  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS)
  await service.getEntry(1)

  expect(counts['/manifest.json']).toBe(2)
  expect(counts['/v1/questions/index.json']).toBe(1)
})

it('⑤ 버전이 바뀌면 인덱스를 다시 받아 새 정답으로 채점한다', async () => {
  const service = createService()
  await service.getEntry(1)

  liveVersion = 'v2'
  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS)

  expect((await service.getEntry(1))?.answer).toEqual(['B'])
  expect(counts['/v2/questions/index.json']).toBe(1)
})

it('⑥ 캐시가 비었는데 못 받으면 503이다', async () => {
  isFailing = true

  await expect(createService().getEntry(1)).rejects.toBeInstanceOf(ServiceUnavailableException)
})

it('⑦ 재확인이 실패하면 기존 캐시를 유지한다', async () => {
  const service = createService()
  await service.getEntry(1)

  isFailing = true
  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS)

  expect((await service.getEntry(1))?.answer).toEqual(['A'])
})

it('⑧ 재확인이 실패해도 다음 주기까지는 CDN을 다시 치지 않는다', async () => {
  const service = createService()
  await service.getEntry(1)

  isFailing = true
  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS)
  await service.getEntry(1)
  await service.getEntry(1)

  // 실패해도 확인 시각은 찍힌다 — 안 찍으면 요청마다 5초 타임아웃을 문다
  expect(counts['/manifest.json']).toBe(2)
})

it('⑨ manifest에 version이 없으면 500이 아니라 503이다', async () => {
  isVersionless = true

  await expect(createService().getEntry(1)).rejects.toBeInstanceOf(ServiceUnavailableException)
})

/**
 * `content_version`은 「이 65문항이 어느 버전의 정답으로 채점되는가」를 뜻한다. 문항과
 * 버전을 따로 물으면 그 사이 5분 재확인이 끼어들어 v1 문항에 v2 버전이 박힐 수 있고,
 * 그 세션은 `finish`에서 영원히 409다 (SJO-16).
 */
it('⑨ loadExamPool은 문항과 버전을 같은 스냅샷에서 준다', async () => {
  const service = createService()

  const first = await service.loadExamPool()
  expect(first.version).toBe('v1')
  expect(first.questionIds).toEqual([1])

  liveVersion = 'v2'
  vi.advanceTimersByTime(MANIFEST_CHECK_INTERVAL_MS)

  const second = await service.loadExamPool()
  expect(second.version).toBe('v2')
  expect(await service.getVersion()).toBe('v2')
})

it('⑩ getVersion은 캐시가 비면 503이다 — 낡은 버전을 지어내지 않는다', async () => {
  isFailing = true

  await expect(createService().getVersion()).rejects.toBeInstanceOf(ServiceUnavailableException)
})
