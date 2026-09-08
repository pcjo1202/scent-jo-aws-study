'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { QuestionStatesResponse } from '@aws-study/shared'

import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { meKeys, wrongQuestionsQuery } from '@/shared/api/me'
import {
  activeFilterCount,
  filterQuestions,
  hasActiveFilter,
  NO_FILTER,
  toFilterOptions,
  type FilterGroup,
  type QuestionFilter,
} from '@/shared/lib/question-filter'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

import { FilterPanel } from '@/features/filter-questions/ui/filter-panel'
import { AppliedFilterChips } from '@/features/filter-questions/ui/applied-filter-chips'

import { ReviewSet } from './review-set'

/**
 * **카테고리 한 그룹뿐이다** — 오답 세트는 정의상 전부 오답이라 「풀이 상태」가 성립하지 않고,
 * 서비스·정답 개수는 이미 좁혀진 집합을 더 좁힐 값이 아니다 (`docs/02-features.md`
 * 「`/review` 오답 복습」 · `DESIGN.md` 「필터 패널」).
 */
const REVIEW_FILTER_GROUPS: readonly FilterGroup[] = ['categories']

/**
 * 「풀이 상태」 그룹을 그리지 않으므로 `filter.solveStates`가 언제나 비어 있고, 빈 그룹은
 * 통과다(`question-filter.ts`). 그래서 상태 맵을 받지 않아도 결과가 같다 — `/me/question-states`를
 * 부르지 않는 이유다. **이 상수를 지우려면 그룹을 늘릴 때 함께 봐야 한다.**
 */
const NO_STATES: QuestionStatesResponse['states'] = {}

/**
 * 오답 세트를 소유한다. **세트 구성은 진입 시 고정이다** — 제출해도 `wrongQuestionsQuery`를
 * 다시 받지 않으므로 맞힌 문항이 그 자리에서 빠지지 않는다. 풀 때마다 목록이 줄면 `3 / 27`이
 * 흔들려 어디까지 왔는지를 알 수 없다 (`docs/02-features.md` 「화면 구성 요소」).
 *
 * 고정을 푸는 것은 **「다시 풀기」 하나**다. 그때 오답 목록을 무효화하고 `round`를 올려
 * `ReviewSet`을 다시 마운트한다 — `round` 없이 세트 내용만으로 `key`를 만들면 **전부 다시
 * 틀렸을 때 세트가 그대로라 remount가 안 일어나** 완주 화면에 갇힌다.
 */
export function ReviewScreen({ apiUrl }: { apiUrl: string }) {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))
  const { data: wrong } = useSuspenseQuery(wrongQuestionsQuery(apiUrl))

  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<QuestionFilter>(NO_FILTER)
  const [isPanelOpen, setPanelOpen] = useState(false)
  const [round, setRound] = useState(0)

  // 오답 세트. `/me/wrong`이 번호 오름차순으로 주고 인덱스도 번호순이라 정렬이 따로 필요 없다
  // (`docs/05-database.md` 「오답 목록」).
  const wrongEntries = useMemo(() => {
    const wrongIds = new Set(wrong.questionIds)

    return index.entries.filter((entry) => wrongIds.has(entry.id))
  }, [index, wrong])

  // 필터 목록은 **고정된 오답 세트**에서 도출한다. 전체 인덱스에서 뽑으면 오답이 하나도 없는
  // 카테고리가 칩으로 서고, 누르는 즉시 0건이 된다 (`docs/02-features.md` 「필터」).
  const options = useMemo(() => toFilterOptions(wrongEntries), [wrongEntries])
  const entries = useMemo(
    () => filterQuestions(wrongEntries, filter, NO_STATES),
    [wrongEntries, filter],
  )
  // 서비스명이 유일하지 않다 — `/study`와 같은 이유로 뒤엣것이 이긴다 (`study-screen.tsx`).
  const notes = useMemo(
    () => new Map(oneLiners.items.map((item) => [item.service, item.note])),
    [oneLiners],
  )

  const isFiltered = hasActiveFilter(filter)
  const badgeCount = activeFilterCount(filter)

  return (
    <div className="app-bar-gutter-top flex min-h-dvh flex-col">
      <div className="flex flex-1 expanded:flex-row">
        <FilterPanel
          options={options}
          filter={filter}
          matchCount={entries.length}
          isOpen={isPanelOpen}
          onChange={setFilter}
          onClose={() => setPanelOpen(false)}
          shownGroups={REVIEW_FILTER_GROUPS}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <ReviewSet
            key={`${round}:${JSON.stringify(filter)}`}
            apiUrl={apiUrl}
            manifest={manifest}
            entries={entries}
            hasFilter={isFiltered}
            notes={notes}
            appliedChips={<AppliedFilterChips filter={filter} />}
            onClearFilter={() => setFilter(NO_FILTER)}
            onRestart={() => {
              void queryClient.invalidateQueries({ queryKey: meKeys.wrong(apiUrl) })
              setRound((current) => current + 1)
            }}
            onSubmitted={() => {
              // 진도만 무효화한다. **오답 목록은 건드리지 않는다** — 다시 받으면 맞힌 문항이
              // 커서 아래에서 빠져 「진입 시 고정」이 깨진다.
              void queryClient.invalidateQueries({ queryKey: meKeys.progress(apiUrl) })
            }}
            filterAction={
              <button
                type="button"
                aria-label={badgeCount > 0 ? `필터 ${badgeCount}개 적용` : '필터'}
                onClick={() => setPanelOpen(true)}
                className="state-layer relative flex size-12 items-center justify-center rounded-corner-full expanded:hidden"
              >
                <MaterialSymbol name="filter_list" />
                {badgeCount > 0 && (
                  <span className="absolute right-1 top-1 min-w-4 rounded-corner-full bg-secondary-container px-1 text-center text-label-medium text-on-secondary-container">
                    {badgeCount}
                  </span>
                )}
              </button>
            }
          />
        </div>
      </div>
    </div>
  )
}
