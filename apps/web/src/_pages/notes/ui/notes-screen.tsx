'use client'

import { ListHeader, SearchField } from '@scent-jo/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import {
  comparisonsQuery,
  manifestQuery,
  oneLinersQuery,
  questionIndexQuery,
} from '@/shared/api/cdn'
import { EmptyState } from '@/shared/ui/empty-state'

import { groupByCategory, searchOneLiners, sortByImportance } from '../lib/notes-index'

import { ComparisonList } from './comparison-list'
import { OneLinerList } from './one-liner-list'

/**
 * 암기 노트 (`docs/02-features.md` 「`/notes` 암기 노트」). 읽는 화면 하나라 하단 액션 바가
 * 없고 앱바 우측도 비어 있다.
 *
 * **CDN만 읽는다** — api 조회가 없어 진도·시도 기록과 무관하다. manifest·index는
 * `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀고, 노트 둘은 여기서 처음 받는다.
 * 인덱스를 읽는 이유는 하나뿐이다: 어느 서비스에 문항이 있는지를 알아야 죽은 링크를
 * 안 그린다 (`docs/02` 「한줄노트」).
 */
export function NotesScreen() {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))
  const { data: comparisons } = useSuspenseQuery(comparisonsQuery(manifest))

  const [query, setQuery] = useState('')

  const questionServices = useMemo(
    () => new Set(index.entries.flatMap((entry) => entry.services)),
    [index],
  )
  const groups = useMemo(
    () => groupByCategory(searchOneLiners(oneLiners.items, query)),
    [oneLiners, query],
  )
  const sortedComparisons = useMemo(() => sortByImportance(comparisons.items), [comparisons])

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHeader title="한줄노트" />
        {/*
          검색은 한줄노트에만 걸리므로 입력이 페이지 머리가 아니라 이 제목 아래에 있다
          (`docs/02` 「한줄노트」). 입력은 DS `SearchField`를 그대로 쓴다 — 글자가 작으면
          iOS Safari가 포커스에서 화면을 확대한다 (`DESIGN.md` 「화면 보조 패널」).
        */}
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="서비스 이름"
          aria-label="한줄노트 서비스 검색"
        />

        {/*
          라이브 리전은 **문구보다 먼저** DOM에 있어야 낭독되므로 비어 있어도 항상
          렌더한다 (`DESIGN.md` 「상태 배너」). 목록 자체를 감싸지 않는 이유는 203개가
          글자 하나마다 통째로 다시 낭독되기 때문이다.
        */}
        <div aria-live="polite">
          {groups.length === 0 && <EmptyState message="검색 결과 없음" />}
        </div>

        {groups.length > 0 && <OneLinerList groups={groups} questionServices={questionServices} />}
      </section>

      <section>
        <SectionHeader title="비교노트" />
        <ComparisonList comparisons={sortedComparisons} />
      </section>
    </div>
  )
}

/** 두 구역의 제목. 구역 안 카테고리 그룹 제목(`OneLinerList`)보다 한 단계 크다. */
function SectionHeader({ title }: { title: string }) {
  return (
    <ListHeader
      size="medium"
      verticalPadding="small"
      horizontalPadding="small"
      title={<ListHeader.TitleParagraph>{title}</ListHeader.TitleParagraph>}
    />
  )
}
