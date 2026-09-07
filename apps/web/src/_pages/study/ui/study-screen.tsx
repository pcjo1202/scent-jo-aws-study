'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { progressQuery, questionStatesQuery } from '@/shared/api/me'
import {
  activeFilterCount,
  filterQuestions,
  hasActiveFilter,
  NO_FILTER,
  toFilterOptions,
  type QuestionFilter,
} from '@/shared/lib/question-filter'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

import { FilterPanel } from '@/features/filter-questions/ui/filter-panel'
import { AppliedFilterChips } from '@/features/filter-questions/ui/applied-filter-chips'

import { StudySet } from './study-set'

/**
 * 필터를 소유하고 세트를 만든다. 카테고리·서비스·정답 개수는 **인덱스만으로** 처리하고
 * 풀이 상태만 서버에서 온다 (`docs/02-features.md` 「필터」).
 *
 * **필터가 바뀌면 `StudySet`을 통째로 다시 마운트한다** (`key`). 세트·시작 위치·채점 결과가
 * 한꺼번에 새로 시작해야 하는데, 그것들을 각자 동기화하면 하나를 빠뜨렸을 때 이전 문항의
 * 채점 결과가 새 세트에 남는다.
 *
 * **제출 뒤 풀이 상태를 다시 받지 않는다.** 받으면 세트가 커서 아래에서 줄어들어 「지금 보이는
 * 세트」가 흔들린다 — `/review`가 세트를 진입 시 고정하는 것과 같은 이유다.
 */
export function StudyScreen({ apiUrl }: { apiUrl: string }) {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))
  const { data: progress } = useSuspenseQuery(progressQuery(apiUrl))
  const { data: questionStates } = useSuspenseQuery(questionStatesQuery(apiUrl))

  const [filter, setFilter] = useState<QuestionFilter>(NO_FILTER)
  const [isPanelOpen, setPanelOpen] = useState(false)

  const options = useMemo(() => toFilterOptions(index.entries), [index])
  const entries = useMemo(
    () => filterQuestions(index.entries, filter, questionStates.states),
    [index, filter, questionStates],
  )
  const notes = useMemo(
    () => new Map(oneLiners.items.map((item) => [item.service, item.note])),
    [oneLiners],
  )

  const isFiltered = hasActiveFilter(filter)
  const badgeCount = activeFilterCount(filter)

  return (
    // 앱바가 `fixed`라 흐름에서 빠져 있다. 패널과 본문이 **둘 다** 그 아래에서 시작해야
    // 하므로 여백을 여기서 한 번에 준다 (`DESIGN.md` 「화면 보조 패널」).
    <div className="app-bar-gutter-top flex min-h-dvh flex-col">
      <div className="flex flex-1 expanded:flex-row">
        <FilterPanel
          options={options}
          filter={filter}
          matchCount={entries.length}
          isOpen={isPanelOpen}
          onChange={setFilter}
          onClose={() => setPanelOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <StudySet
            key={JSON.stringify(filter)}
            apiUrl={apiUrl}
            manifest={manifest}
            entries={entries}
            // 필터 모드는 진행 위치를 저장하지 않으므로 포인터를 무시한다.
            lastQuestionId={isFiltered ? 0 : progress.lastQuestionId}
            hasFilter={isFiltered}
            notes={notes}
            appliedChips={<AppliedFilterChips filter={filter} />}
            onClearFilter={() => setFilter(NO_FILTER)}
            filterAction={
              // `expanded`에서는 패널이 이미 열려 있으므로 이 버튼이 사라진다
              // (`DESIGN.md` 「화면별 우측 액션」). 규칙 하나가 세 화면을 덮는다.
              <button
                type="button"
                aria-label="필터"
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
