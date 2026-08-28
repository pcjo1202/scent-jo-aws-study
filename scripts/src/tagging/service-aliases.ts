import type { OneLiner } from '../notes/parse-oneliner.ts'

/**
 * 한줄노트의 서비스명을 지문에서 찾기 위한 별칭 사전 (`04-data-model.md` 「자동 태깅」).
 *
 * **카테고리의 SSOT는 `oneliners.json`의 `category`다.** 이 파일은 어떤 이름이
 * 어떤 서비스를 가리키는지만 정하고, 그 서비스가 어느 카테고리인지는 노트에서
 * 그대로 읽는다 — 롤업 표를 따로 두면 사전과 갈라진다.
 */

/** 노트가 기능 단위로만 실어 맨 이름이 사전에 없는 서비스. */
export type RootService = { root: string; service: string }

/** 지문이 한글로 옮겨 쓰는 표기. */
export type KoreanAlias = { alias: string; service: string }

export type AliasSupplements = { roots: RootService[]; koreanAliases: KoreanAlias[] }

export type ServiceAlias = {
  alias: string
  service: string
  /** 한 서비스가 카테고리 둘에 실릴 수 있다 (`04` 「oneliners.json」). */
  categories: string[]
}

/**
 * 노트가 기능만 싣고 맨 이름을 빠뜨린 서비스들. 괄호 안은 실측 등장 문항 수다.
 *
 * 이 보완을 빼고 돌리면 미태깅이 6 → 63문항, 스토리지가 355 → 151문항(34.8% →
 * 14.8%)으로 무너진다. 맨 `S3`를 말하는 289문항 중 222문항이 스토리지 태그를
 * 잃고 40문항은 아무 서비스에도 걸리지 않는다 (2026-08-28 실측).
 *
 * 카테고리는 여기 적지 않는다. 그 루트로 시작하는 노트 항목의 다수결로 끌어온다.
 */
const ROOT_SERVICES: RootService[] = [
  { root: 'S3', service: 'Amazon S3' }, // 289
  { root: 'IAM', service: 'AWS IAM' }, // 65
  { root: 'FSx', service: 'Amazon FSx' }, // 30
  { root: 'Kinesis', service: 'Amazon Kinesis' }, // 25
  { root: 'ElastiCache', service: 'Amazon ElastiCache' }, // 20
  { root: 'Storage Gateway', service: 'AWS Storage Gateway' }, // 14
  { root: 'Snowball', service: 'AWS Snowball' }, // 12
  { root: 'Shield', service: 'AWS Shield' }, // 8
]

/**
 * 지문이 한글로 옮겨 쓰는 이름. 괄호 안은 실측 등장 문항 수다.
 *
 * `람다`는 이 코퍼스에 0건이다. 이슈가 표기 흔들림의 예로 든 형태라 남겨 두지만,
 * 지금 문제은행은 서비스명을 영문 그대로 쓴다.
 */
const KOREAN_ALIASES: KoreanAlias[] = [
  { alias: '보안 그룹', service: 'Security Group' }, // 25
  { alias: 'NAT 게이트웨이', service: 'NAT Gateway' }, // 13
  { alias: '읽기 전용 복제본', service: 'Read Replica' }, // 12
  { alias: '게이트웨이 엔드포인트', service: 'VPC Gateway Endpoint' }, // 11
  { alias: '인터넷 게이트웨이', service: 'Internet Gateway' }, // 5
  { alias: '인터페이스 엔드포인트', service: 'VPC Interface Endpoint' }, // 1
  { alias: '람다', service: 'AWS Lambda' }, // 0
]

/**
 * 벤더 접두사를 떼면 일반 명사가 되어 남의 서비스에 걸리는 별칭.
 *
 * `AWS Batch` → `Batch`가 `S3 Batch Operations`를 말하는 문항 4개(216·446·740·912)를
 * 먹었다. `AWS Batch`가 붙은 8문항의 절반이다. 사전에 같은 모양이 더 있지만
 * (`Config`·`Backup`·`Artifact`·`Inspector`·`Organizations`·`Amplify`·`Shield`) 이
 * 코퍼스에서 벤더명 없이 걸린 문항은 전부 0건이라 넣지 않는다 — 안 터진 것을 미리
 * 막으면 진짜 언급까지 놓친다 (2026-08-28 실측).
 */
const AMBIGUOUS_STRIPPED_ALIASES = new Set(['Batch'])

export const NOTE_SUPPLEMENTS: AliasSupplements = {
  roots: ROOT_SERVICES,
  koreanAliases: KOREAN_ALIASES,
}

/** 한 글자 별칭은 지문 아무 데나 걸린다. */
const MIN_ALIAS_LENGTH = 2
const VENDOR_PREFIX = /^(?:Amazon|AWS)\s+(.+)$/
const PARENTHESIZED = /^(.+?)\s*\(([^)]+)\)\s*$/
const LEGACY_NAME_PREFIX = /^기존\s+/
const DASH_SEPARATOR = ' - '
const SLASH_SEPARATOR = ' / '

/**
 * 별칭을 **긴 것부터** 돌려준다. 매칭이 최장일치를 택하는 근거가 이 순서다
 * (`tag-question.ts`) — `EC2`가 `EC2 Spot Instance`를 먼저 먹으면 안 된다.
 *
 * 길이가 같으면 이름순으로 가른다. 같은 자리를 두고 다투는 동률 별칭의 승자가
 * 노트를 읽은 순서에 좌우되면, 노트 한 줄이 바뀔 때 태그가 조용히 흔들린다.
 */
export function buildServiceAliases(
  oneLiners: OneLiner[],
  supplements: AliasSupplements = NOTE_SUPPLEMENTS,
): ServiceAlias[] {
  const categoriesByService = new Map<string, string[]>()
  for (const { service, category } of oneLiners) {
    const categories = categoriesByService.get(service) ?? []
    if (!categories.includes(category)) categories.push(category)
    categoriesByService.set(service, categories)
  }

  const byAlias = new Map<string, ServiceAlias>()
  function put(alias: string, service: string, categories: string[]) {
    const existing = byAlias.get(alias.toLowerCase())
    if (existing !== undefined && existing.service !== service) {
      throw new Error(`별칭 «${alias}»이 두 서비스를 가리킨다: ${existing.service} vs ${service}`)
    }
    if (existing !== undefined) return

    byAlias.set(alias.toLowerCase(), { alias, service, categories })
  }

  for (const [service, categories] of categoriesByService) {
    for (const alias of expandAliases(service)) put(alias, service, categories)
  }

  const derived = [...byAlias.values()]
  for (const { root, service } of supplements.roots) {
    put(root, service, categoriesOfRoot(root, derived))
  }
  for (const { alias, service } of supplements.koreanAliases) {
    const categories = categoriesByService.get(service)
    if (categories === undefined) {
      throw new Error(`한글 별칭 «${alias}»이 노트에 없는 서비스를 가리킨다: ${service}`)
    }
    put(alias, service, categories)
  }

  return [...byAlias.values()].sort(
    (a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias),
  )
}

/**
 * 루트의 카테고리는 그 루트로 시작하는 별칭을 가진 **서비스**의 다수결이다.
 *
 * 표는 서비스당 하나다. 한 서비스가 별칭을 여럿 내도(`S3 Replication (CRR/SRR)`)
 * 한 표이고, 벤더 접두사를 뗀 별칭으로 참여하는 것도 받는다 — `AWS Shield Standard`는
 * 이름이 `Shield`로 시작하지 않지만 `Shield Standard`가 시작한다.
 *
 * `S3 Bucket Policy`는 보안이지만 나머지 18개 `S3 *`는 스토리지다 — 소수 항목 하나
 * 때문에 루트를 포기하지 않고, 표가 아예 없으면 지어내지 않고 던진다.
 *
 * 동률은 이름순으로 가른다. 승자가 노트를 읽은 순서에 좌우되면 노트 한 줄이 바뀔 때
 * 루트 하나의 카테고리가 통째로 뒤집힌다.
 */
function categoriesOfRoot(root: string, derived: ServiceAlias[]): string[] {
  const prefix = `${root.toLowerCase()} `
  const votedServices = new Set<string>()
  const tally = new Map<string, number>()

  for (const entry of derived) {
    if (!entry.alias.toLowerCase().startsWith(prefix)) continue
    if (votedServices.has(entry.service)) continue

    votedServices.add(entry.service)
    for (const category of entry.categories) tally.set(category, (tally.get(category) ?? 0) + 1)
  }

  const ranked = [...tally].sort(([nameA, a], [nameB, b]) => b - a || nameA.localeCompare(nameB))
  const top = ranked[0]
  if (top === undefined) {
    throw new Error(`루트 «${root}»으로 시작하는 별칭을 가진 서비스가 없다 — 카테고리를 정할 수 없다`)
  }

  return [top[0]]
}

/** 서비스명 하나가 지문에서 쓰일 수 있는 표기들. */
function expandAliases(service: string): string[] {
  const aliases = new Set<string>()
  function add(name: string) {
    const trimmed = name.trim()
    if (trimmed.length < MIN_ALIAS_LENGTH) return

    aliases.add(trimmed)
    const withoutVendor = trimmed.match(VENDOR_PREFIX)
    if (!withoutVendor) return

    const stripped = withoutVendor[1]!.trim()
    if (!AMBIGUOUS_STRIPPED_ALIASES.has(stripped)) aliases.add(stripped)
  }

  const parenthesized = service.match(PARENTHESIZED)
  const base = parenthesized ? parenthesized[1]!.trim() : service
  add(service)
  add(base)

  if (parenthesized) {
    // "(기존 X)"의 X는 옛 이름이고, "(CRR/SRR)"처럼 약어를 나열한 괄호는 이름이 아니다.
    const inner = parenthesized[2]!.replace(LEGACY_NAME_PREFIX, '')
    if (!inner.includes('/')) add(inner)
  }
  if (base.includes(DASH_SEPARATOR)) add(base.replaceAll(DASH_SEPARATOR, ' '))
  if (base.includes(SLASH_SEPARATOR)) for (const part of base.split(SLASH_SEPARATOR)) add(part)

  return [...aliases]
}
