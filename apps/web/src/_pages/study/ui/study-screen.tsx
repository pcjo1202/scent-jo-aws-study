'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { meKeys, progressQuery, questionStatesQuery } from '@/shared/api/me'
import {
  activeFilterCount,
  filterQuestions,
  hasActiveFilter,
  NO_FILTER,
  toFilterOptions,
  type QuestionFilter,
} from '@/shared/lib/question-filter'
import { toStartIndex } from '@/shared/lib/study-cursor'
import { ScreenShell } from '@/shared/ui/screen-shell'

import { FilterPanel } from '@/features/filter-questions/ui/filter-panel'
import { FilterButton } from '@/features/filter-questions/ui/filter-button'
import { AppliedFilterChips } from '@/features/filter-questions/ui/applied-filter-chips'

import { StudySet } from './study-set'

const SCREEN_NAME = '순차 풀이'

/**
 * 필터를 소유하고 세트를 만든다. 카테고리·서비스·정답 개수는 **인덱스만으로** 처리하고
 * 풀이 상태만 서버에서 온다 (`docs/02-features.md` 「필터」).
 *
 * **필터가 바뀌면 `StudySet`을 통째로 다시 마운트한다** (`key`). 선택·채점 결과가 한꺼번에
 * 새로 시작해야 하는데, 그것들을 각자 동기화하면 하나를 빠뜨렸을 때 이전 문항의 채점 결과가
 * 새 세트에 남는다. 커서만 여기서 쥐고 같은 순간에 시작 위치로 되돌린다 — 앱바와 사이드바를
 * 이 화면이 그리기 때문이다 (`StudySet` 주석).
 *
 * **제출 뒤 두 쿼리를 다르게 다룬다.**
 *
 * - `questionStates`는 **다시 받지 않는다.** 받으면 세트가 커서 아래에서 줄어들어 「지금
 *   보이는 세트」가 흔들린다 — `/review`가 세트를 진입 시 고정하는 것과 같은 이유다
 * - `progress`는 **무효화한다.** 포인터는 세트 구성이 아니라 **시작 위치**라 다시 받아도
 *   지금 보이는 세트가 흔들리지 않는다. 안 받으면 필터를 걸었다 해제할 때 낡은
 *   포인터로 커서를 다시 계산해 **이미 푼 문항을 다시 푼다**
 */
export function StudyScreen({
  apiUrl,
  initialFilter,
}: {
  apiUrl: string
  /**
   * URL이 실어 온 필터 (`toInitialFilter`). **초기값으로만 읽는다** — 여기서 걸리면
   * `hasFilter`가 참이 되어 `advancesPointer`가 `false`로 가고, 그것이 「이 경로로 푼
   * 문항은 전체 진도 포인터를 움직이지 않는다」의 구현이다 (`docs/02` 「한줄노트」).
   */
  initialFilter: QuestionFilter
}) {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))
  const { data: progress } = useSuspenseQuery(progressQuery(apiUrl))
  const { data: questionStates } = useSuspenseQuery(questionStatesQuery(apiUrl))

  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<QuestionFilter>(initialFilter)
  const [isPanelOpen, setPanelOpen] = useState(false)

  const options = useMemo(() => toFilterOptions(index.entries), [index])
  const entries = useMemo(
    () => filterQuestions(index.entries, filter, questionStates.states),
    [index, filter, questionStates],
  )
  // 서비스명이 유일하지 않다 — 한 서비스가 카테고리를 달리해 두 번 실려 203항목에 고유
  // 이름은 202다 (`packages/shared`의 `OneLiner`). 뒤엣것이 이기는데, 같은 서비스의 설명이
  // 둘 다 그 서비스를 설명하므로 어느 쪽이든 화면이 틀리지 않는다.
  const notes = useMemo(
    () => new Map(oneLiners.items.map((item) => [item.service, item.note])),
    [oneLiners],
  )

  const isFiltered = hasActiveFilter(filter)
  const badgeCount = activeFilterCount(filter)

  // 커서는 필터가 바뀌면 그 세트의 시작 위치로 돌아간다. **렌더 중에 한 번 확정해 상태로
  // 넣는다** — 매 렌더 파생하면 제출 뒤 진도가 다시 와서 포인터가 움직일 때 채점 화면이
  // 다음 문항으로 넘어간다. 필터 모드는 진행 위치를 저장하지 않으므로 포인터를 무시한다.
  const startCursor =
    toStartIndex(
      entries.map((entry) => entry.id),
      isFiltered ? 0 : progress.lastQuestionId,
    ) ?? entries.length
  const [cursorState, setCursorState] = useState({ filter, cursor: startCursor })
  let cursor = cursorState.cursor
  if (cursorState.filter !== filter) {
    cursor = startCursor
    setCursorState({ filter, cursor })
  }

  const isEmpty = entries.length === 0
  const isFinished = !isEmpty && cursor >= entries.length
  const isSolving = !isEmpty && !isFinished

  const panelProps = {
    options,
    filter,
    matchCount: entries.length,
    onChange: setFilter,
  }

  // 빈 상태·완주에서는 제목에서 숫자가 빠지고 진행 바를 그리지 않는다. 우측 필터 버튼은
  // 그대로 둔다 — 필터가 0건일 때 그것이 없으면 되돌릴 방법이 사라진다 (`DESIGN.md`
  // 「빈 상태·완주에서 골격은 어떻게 되나」).
  return (
    <>
      <ScreenShell
        title={isSolving ? `${SCREEN_NAME} ${cursor + 1} / ${entries.length}` : SCREEN_NAME}
        backHref="/"
        trailing={<FilterButton badgeCount={badgeCount} onClick={() => setPanelOpen(true)} />}
        progress={isSolving ? { current: cursor + 1, total: entries.length } : undefined}
        sidebar={<FilterPanel container="sidebar" {...panelProps} />}
      >
        <StudySet
          key={JSON.stringify(filter)}
          apiUrl={apiUrl}
          manifest={manifest}
          entries={entries}
          cursor={cursor}
          isEmpty={isEmpty}
          isFinished={isFinished}
          hasFilter={isFiltered}
          notes={notes}
          appliedChips={<AppliedFilterChips filter={filter} />}
          onClearFilter={() => setFilter(NO_FILTER)}
          onSubmitted={() => {
            void queryClient.invalidateQueries({ queryKey: meKeys.progress(apiUrl) })
          }}
          onCursorChange={(next) => setCursorState({ filter, cursor: next })}
        />
      </ScreenShell>

      <FilterPanel
        container="sheet"
        isOpen={isPanelOpen}
        onClose={() => setPanelOpen(false)}
        {...panelProps}
      />
    </>
  )
}
