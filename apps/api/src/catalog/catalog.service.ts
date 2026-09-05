import type { IndexEntry, Manifest, QuestionIndex } from '@aws-study/shared'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { pickExamQuestions } from './grading'

/** manifest의 `Cache-Control: max-age=300`과 같은 값이다 (`04-data-model.md` 「manifest.json」). */
const MANIFEST_CHECK_INTERVAL_MS = 5 * 60 * 1000
/** 서버리스에서 매달린 요청은 플랫폼 타임아웃까지 산다. fetch에는 기본 타임아웃이 없다. */
const FETCH_TIMEOUT_MS = 5_000

type Cache = { version: string; entries: Map<number, IndexEntry> }

/**
 * CDN 인덱스를 메모리에 캐시한다 (`05-database.md` 「catalog 모듈」).
 *
 * **부팅에서 CDN을 부르지 않는다.** 빈 캐시로 기동하고 첫 접근이 받는다 — 콜드 스타트마다
 * 부팅인 서버리스에서 부팅 로드는 CDN 일시 장애를 `/health`까지 죽이고, 빌드 게이트가
 * 네트워크에 의존하게 만든다 (「CDN 장애」, 2026-09-06 SJO-30 E3 결정).
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name)
  private readonly rootUrl: string
  private cache: Cache | null = null
  private checkedAt = 0

  constructor(configService: ConfigService) {
    // manifest는 버전 경로 밖에 있다. 인덱스 경로는 manifest의 base가 준다 (`06-environment.md`)
    this.rootUrl = configService.getOrThrow<string>('DATA_BASE_URL').replace(/\/+$/, '')
  }

  async getEntry(questionId: number) {
    const { entries } = await this.ensureIndex()

    return entries.get(questionId)
  }

  async pickExam() {
    const { entries } = await this.ensureIndex()

    return pickExamQuestions([...entries.keys()])
  }

  /**
   * 캐시가 있고 재확인 주기 안이면 네트워크를 타지 않는다.
   *
   * ponytail: 동시 요청이 각자 받는다. 사용자가 1명이고 받는 것이 콜드 스타트당 13.5KB라
   * 진행 중 Promise를 공유하는 장치를 두지 않았다 — 인스턴스가 늘면 그때 붙인다.
   */
  private async ensureIndex(): Promise<Cache> {
    const isStale = Date.now() - this.checkedAt >= MANIFEST_CHECK_INTERVAL_MS
    if (this.cache && !isStale) return this.cache

    try {
      await this.reload()
    } catch (error) {
      // 캐시가 있으면 낡은 정답으로 계속 간다 — 무응답보다 낫고, 버전은 몇 달에 한 번
      // 바뀐다 (`05-database.md` 「CDN 장애」)
      if (!this.cache) throw new ServiceUnavailableException('카탈로그 인덱스를 받지 못했다')

      this.logger.warn(`카탈로그 재확인 실패, 기존 캐시(${this.cache.version}) 유지: ${describe(error)}`)
    }

    // reload가 던지지 않았거나 위에서 기존 캐시를 확인했으므로 null이 아니다
    return this.cache as Cache
  }

  private async reload() {
    const manifest = await fetchJson<Manifest>(`${this.rootUrl}/manifest.json`, 'manifest.json')
    this.checkedAt = Date.now()
    if (this.cache?.version === manifest.version) return

    const base = manifest.base.replace(/\/+$/, '')
    const index = await fetchJson<QuestionIndex>(`${base}/questions/index.json`, 'index.json')

    this.cache = {
      version: manifest.version,
      entries: new Map(index.entries.map((entry) => [entry.id, entry])),
    }
    this.logger.log(`카탈로그 ${manifest.version} 적재 — ${index.entries.length}문항`)
  }
}

/** URL을 메시지에 넣지 않는다 — 랜덤 프리픽스가 로그로 샌다 (`03-architecture.md` 「CORS」). */
async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${label} → HTTP ${response.status}`)

  // 구조는 data:publish 전 `data:verify`가 보증한다 (`08-testing.md` 「data:verify」)
  return (await response.json()) as T
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
