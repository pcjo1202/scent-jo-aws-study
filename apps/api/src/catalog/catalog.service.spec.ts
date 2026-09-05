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

function toIndex(answer: string) {
  return { entries: [{ id: 1, chunk: 1, categories: [], services: [], answer: [answer], choiceCount: 4 }] }
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
        ? { version: liveVersion, generatedAt: '', base: `${rootUrl}/${liveVersion}`, questions: {}, files: {} }
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
