import type { Comparison, OneLiner } from '@aws-study/shared'

/**
 * `/notes`가 목록을 세우는 규칙 (`docs/02-features.md` 「`/notes` 암기 노트」).
 *
 * 화면이 아니라 여기 두는 이유는 셋 다 순수 함수이고 규칙이 문서에서 온 값이기 때문이다 —
 * 컴포넌트 안에 두면 정렬 근거를 따로 검증할 방법이 없다.
 */
export type OneLinerGroup = { category: string; items: OneLiner[] }

/**
 * 서비스명 부분일치. 대소문자를 가리지 않는다 — `s3`로도 `Amazon S3`를 찾는다.
 *
 * **카테고리는 검색어에 걸지 않는다.** 카테고리는 그룹 축이라 이미 화면에 제목으로 서 있고,
 * 여기까지 걸면 「분석」을 쳤을 때 이름에 그 말이 없는 항목 9개가 딸려 온다.
 */
export function searchOneLiners(items: readonly OneLiner[], query: string): OneLiner[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...items]

  return items.filter((item) => item.service.toLowerCase().includes(needle))
}

/**
 * 카테고리 가나다순 그룹. 그룹 안은 원본 순서다 (`docs/02` 「한줄노트」).
 *
 * **`'ko'`를 넘긴다 — 기본 로케일과 결과가 다르다.** ko 콜레이션은 한글을 라틴 문자보다 앞에
 * 두므로 11개 중 유일한 영문 이름인 `AI/ML`이 **맨 끝**에 선다. 로케일을 빼면 그것만 맨 앞으로
 * 온다. 화면 언어가 한국어라 한국어 정렬을 고른 것이고, 뒤집어 보이면 버그가 아니다.
 *
 * **같은 서비스가 두 그룹에 서는 경우가 하나 있다** — 항목 203개에 고유 서비스명이 202개이고
 * 남는 하나는 카테고리가 둘인 서비스다. `note`가 서로 달라 합치면 하나를 버리게 되므로
 * 그대로 둔다. `(service, category)` 쌍은 203개가 전부 유일해 그룹 안에서는 겹치지 않고,
 * 그래서 그 쌍이 React key다 (`packages/shared`의 `OneLiner` · `docs/04` 「oneliners.json」).
 *
 * **빈 그룹을 만들지 않는다.** 검색 결과에만 그룹을 세우므로 0건 카테고리는 제목도 안 선다.
 */
export function groupByCategory(items: readonly OneLiner[]): OneLinerGroup[] {
  const groups = new Map<string, OneLiner[]>()
  for (const item of items) {
    const group = groups.get(item.category)
    if (group) group.push(item)
    else groups.set(item.category, [item])
  }

  return [...groups.entries()]
    .map(([category, groupItems]) => ({ category, items: groupItems }))
    .sort((a, b) => a.category.localeCompare(b.category, 'ko'))
}

/**
 * 중요도 내림차순, 같은 중요도 안은 원본 순서 (`docs/02` 「비교노트」).
 *
 * `sort`가 ES2019부터 **안정 정렬**이라 동점의 원본 순서가 그대로 남는다 — 이 성질이 규칙의
 * 절반이라 비교 함수에 2차 기준을 두지 않았다. `toSorted`를 안 쓰는 이유는 저쪽이 Baseline
 * 2023이라 구형 웹뷰에서 없을 수 있어서다 (이 앱은 웹뷰에서도 열린다 — `DESIGN.md` 「앱바」).
 */
export function sortByImportance(items: readonly Comparison[]): Comparison[] {
  return [...items].sort((a, b) => b.importance - a.importance)
}
