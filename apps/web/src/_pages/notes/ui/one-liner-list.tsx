import { List, ListHeader, ListRow } from '@scent-jo/react'

import type { OneLiner } from '@aws-study/shared'

import { studyServiceHref } from '@/shared/config/study'
import { LinkTextButton } from '@/shared/ui/link-button'

import type { OneLinerGroup } from '../lib/notes-index'

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
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <section key={group.category}>
          <ListHeader
            size="small"
            verticalPadding="small"
            horizontalPadding="small"
            title={
              // 구역 제목(`h2` 수준) 아래 그룹이다. DS 제목은 기본이 `aria-level` 2라 낮춘다.
              <ListHeader.TitleParagraph aria-level={3}>{group.category}</ListHeader.TitleParagraph>
            }
          />
          <List>
            {group.items.map((item) => (
              // key가 `(service, category)`인 이유: `service`만으로는 카테고리가 둘인 서비스
              // 하나에서 충돌한다 (`docs/04` 「oneliners.json」 — 203항목 · 고유 이름 202개).
              <OneLinerRow
                key={`${item.category}/${item.service}`}
                item={item}
                hasQuestions={questionServices.has(item.service)}
              />
            ))}
          </List>
        </section>
      ))}
    </div>
  )
}

/**
 * **문제 링크는 그 서비스에 문항이 있을 때만 그린다.** 한줄노트의 202개 중 인덱스에도 있는
 * 것은 129개뿐이라(`docs/02` 「필터」) 나머지 73개는 눌러도 「조건에 맞는 문제 없음」이다.
 * 링크 자리를 비워 두는 것이 죽은 링크를 주는 것보다 정직하다.
 *
 * **인덱스의 136개에서 빼서 구하지 않는다.** 136과 202는 포함 관계가 아니다 — 인덱스에만 있는
 * `S3`·`IAM` 같은 루트 이름이 7개 있어 `202 - 136`은 답이 아니다. 그래서 뺄셈이 아니라
 * 교집합 판정(`questionServices.has`)이다.
 *
 * **행 전체를 링크로 만들지 않는다.** 읽는 화면이라 본문을 누르다 이동하면 안 되고, 행이 링크면
 * 링크 이름이 노트 본문 전체가 된다. 링크는 본문 아래 텍스트 버튼 하나다 (2026-10-21, SJO-66).
 */
function OneLinerRow({ item, hasQuestions }: { item: OneLiner; hasQuestions: boolean }) {
  return (
    <ListRow
      border="indented"
      horizontalPadding="small"
      contents={
        <>
          <ListRow.Texts type="2RowTypeA" top={item.service} bottom={item.note} />
          {hasQuestions && (
            // DS 기본 글자색(secondary)이 바로 위 설명과 같아 링크가 본문에 묻힌다.
            <LinkTextButton
              size="small"
              href={studyServiceHref(item.service)}
              className="mt-1 text-brand"
            >
              이 서비스가 나온 문제 보기
            </LinkTextButton>
          )}
        </>
      }
    />
  )
}
