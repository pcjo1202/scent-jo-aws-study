'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import {
  comparisonsQuery,
  manifestQuery,
  oneLinersQuery,
  questionIndexQuery,
} from '@/shared/api/cdn'
import { AppBar } from '@/shared/ui/app-bar'
import { EmptyState } from '@/shared/ui/empty-state'

import { groupByCategory, searchOneLiners, sortByImportance } from '@/_pages/notes/lib/notes-index'

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
    <>
      <AppBar title="암기 노트" backHref="/" />

      <div className="app-bar-gutter-top">
        <main className="mx-auto flex w-full max-w-reading flex-col gap-8 px-screen py-6">
          <section>
            <h2>한줄노트</h2>
            {/*
              검색은 한줄노트에만 걸리므로 입력이 페이지 머리가 아니라 이 제목 아래에 있다
              (`docs/02` 「한줄노트」). 글자는 `body-large`(16px)여야 한다 — 그 미만이면
              iOS Safari가 포커스에서 화면을 확대한다 (`DESIGN.md` 「필터 패널」).
            */}
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="서비스 이름"
              aria-label="한줄노트 서비스 검색"
              className="mt-2 h-12 w-full rounded-corner-extra-small border border-outline bg-surface px-4 text-body-large"
            />

            {/*
              라이브 리전은 **문구보다 먼저** DOM에 있어야 낭독되므로 비어 있어도 항상
              렌더한다 (`DESIGN.md` 「상태 배너」). 목록 자체를 감싸지 않는 이유는 203개가
              글자 하나마다 통째로 다시 낭독되기 때문이다.
            */}
            <div aria-live="polite" className="mt-4">
              {groups.length === 0 && <EmptyState message="검색 결과 없음" />}
            </div>

            {groups.length > 0 && (
              <div className="mt-4">
                <OneLinerList groups={groups} questionServices={questionServices} />
              </div>
            )}
          </section>

          <section>
            <h2>비교노트</h2>
            <div className="mt-2">
              <ComparisonList comparisons={sortedComparisons} />
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
