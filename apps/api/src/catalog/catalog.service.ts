import type { IndexEntry, Manifest, QuestionIndex } from '@aws-study/shared'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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

  /** 카테고리별 통계는 전 문항의 태그가 필요하다 (`05-database.md` 「카테고리별 정답률」). */
  async listEntries() {
    const { entries } = await this.ensureIndex()

    return [...entries.values()]
  }

  /**
   * 세션이 `content_version`으로 박아 두고 `finish`가 현재 값과 대조하는 그 버전이다
   * (`05-database.md` 「exam_sessions」).
   *
   * `listEntries()`가 준 문항으로 세션을 만든 뒤 이걸 따로 부르면 그 사이 5분 재확인이
   * 끼어들어 **문항과 버전이 갈릴 수 있다.** 세션을 만들 때는 `loadExamPool()`을 쓴다.
   */
  async getVersion() {
    const { version } = await this.ensureIndex()

    return version
  }

  /**
   * 채점에 필요한 것을 **같은 캐시 스냅샷에서** 준다 — 버전 대조와 정답 조회가 갈리면 안 된다.
   *
   * `getVersion()`으로 v1을 확인한 뒤 `listEntries()`를 따로 부르면 그 사이 5분 재확인이
   * 캐시를 v2로 바꿀 수 있고, 그러면 **v1 기준으로 저장된 `is_correct`에 v2의 정답을 붙여**
   * 「내 답 B / 정답 B / 오답」을 그린다. `loadExamPool()`이 세션 생성에서 막는 것과 같은
   * split read다 (2026-09-07 리뷰).
   */
  async loadGradingSnapshot() {
    const { version, entries } = await this.ensureIndex()

    return { version, entries: [...entries.values()] }
  }

  /**
   * 추첨 풀과 버전을 **같은 캐시 스냅샷에서** 준다.
   *
   * `content_version`은 「이 65문항이 어느 버전의 정답으로 채점되는가」를 뜻한다. 문항을
   * 한 번, 버전을 또 한 번 물으면 그 사이에 캐시가 교체됐을 때 v1 문항에 v2 버전이 박힌다 —
   * 그 세션은 `finish`에서 영원히 409이거나, 더 나쁘게는 조용히 다른 정답으로 채점된다.
   */
  async loadExamPool() {
    const { version, entries } = await this.ensureIndex()

    return { version, questionIds: [...entries.keys()] }
  }

  /**
   * 캐시가 있고 재확인 주기 안이면 네트워크를 타지 않는다.
   *
   * ponytail: 동시 요청이 각자 받는다. 중복 fetch뿐 아니라 **쓰기 순서도 보장되지 않는다** —
   * 버전 전환 5분 창에서 늦게 끝난 옛 인덱스가 새 캐시를 덮을 수 있다(다음 주기에 자가 치유).
   * 사용자가 1명이고 받는 것이 콜드 스타트당 13.5KB라 진행 중 Promise를 공유하는 장치를 두지
   * 않았다 — 인스턴스가 늘면 그때 붙인다.
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

      this.logger.warn(
        `카탈로그 재확인 실패, 기존 캐시(${this.cache.version}) 유지: ${describe(error)}`,
      )
    }

    // reload가 조용히 아무것도 안 채우고 끝나는 경로가 있다 — manifest가 200인데 `version`이
    // 없으면 `undefined === undefined`로 버전이 같다고 보고 인덱스를 건너뛴다. 500이 아니라
    // 503이어야 한다 (`05-database.md` 「오류 응답」)
    if (!this.cache) throw new ServiceUnavailableException('카탈로그 인덱스를 받지 못했다')

    return this.cache
  }

  private async reload() {
    // 성공 뒤가 아니라 시도 시점에 찍는다 — manifest가 죽어 있으면 요청마다 5초 타임아웃을
    // 물고 다시 친다. 「다음 주기에 재시도」가 명세다 (`05-database.md` 「CDN 장애」).
    // 캐시가 비었을 때의 「다음 요청이 재시도」는 ensureIndex의 `this.cache &&` 조건이 지킨다
    this.checkedAt = Date.now()

    const manifest = await fetchJson<Manifest>(`${this.rootUrl}/manifest.json`, 'manifest.json')
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
