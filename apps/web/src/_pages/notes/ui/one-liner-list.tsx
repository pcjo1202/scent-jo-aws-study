import Link from 'next/link'

import type { OneLiner } from '@aws-study/shared'

import { studyServiceHref } from '@/shared/config/study'

import type { OneLinerGroup } from '@/_pages/notes/lib/notes-index'

/**
 * 한줄노트 — 카테고리 그룹 안에 서비스명·설명·문제 링크가 선다
 * (`docs/02-features.md` 「`/notes` 암기 노트 · 한줄노트」).
 *
 * **접지 않는다.** 항목 하나가 평균 84자라 펼침이 아끼는 것이 적고, 찾는 수단은 바로 위의
 * 검색이다. 비교노트만 아코디언인 이유가 그 비대칭이다.
 */
export function OneLinerList({
  groups,
  questionServices,
}: {
  groups: OneLinerGroup[]
  /** 인덱스에 실제로 붙은 서비스명. 여기 없는 이름에는 문제 링크를 그리지 않는다. */
  questionServices: ReadonlySet<string>
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.category}>
          <h3 className="text-title-small text-on-surface-variant">{group.category}</h3>
          <ul className="mt-2 flex flex-col divide-y divide-outline-variant">
            {group.items.map((item) => (
              // key가 `(service, category)`인 이유: `service`만으로는 카테고리가 둘인 서비스
              // 하나에서 충돌한다 (`docs/04` 「oneliners.json」 — 203항목 · 고유 이름 202개).
              <li key={`${item.category}/${item.service}`} className="py-3">
                <OneLinerItem item={item} hasQuestions={questionServices.has(item.service)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * **문제 링크는 그 서비스에 문항이 있을 때만 그린다.** 한줄노트의 202개 중 인덱스에 붙은
 * 것은 136개뿐이라(`docs/02` 「필터」) 나머지 66개는 눌러도 「조건에 맞는 문제 없음」이다.
 * 링크 자리를 비워 두는 것이 죽은 링크를 주는 것보다 정직하다.
 */
function OneLinerItem({ item, hasQuestions }: { item: OneLiner; hasQuestions: boolean }) {
  return (
    <>
      <p className="text-title-small">{item.service}</p>
      <p className="mt-1 text-body-medium text-on-surface-variant">{item.note}</p>
      {hasQuestions && (
        <Link
          href={studyServiceHref(item.service)}
          className="inline-flex min-h-12 items-center text-body-small text-primary"
        >
          이 서비스가 나온 문제 보기
        </Link>
      )}
    </>
  )
}
