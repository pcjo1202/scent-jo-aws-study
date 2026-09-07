'use client'

import { useState } from 'react'

import {
  type AnswerCountKind,
  type QuestionFilter,
  type SolveState,
  hasActiveFilter,
  NO_FILTER,
} from '@/shared/lib/question-filter'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

const ANSWER_COUNT_LABEL: Record<AnswerCountKind, string> = {
  single: '단일정답',
  multiple: '복수정답',
}

const SOLVE_STATE_LABEL: Record<SolveState, string> = {
  unsolved: '안 푼 것',
  wrong: '오답',
  correct: '정답',
}

function toggleValue<T>(selected: readonly T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((chosen) => chosen !== value)
    : [...selected, value]
}

function ChipGroup<T extends string>({
  title,
  values,
  labelOf,
  selected,
  onToggle,
}: {
  title: string
  values: readonly T[]
  labelOf: (value: T) => string
  selected: readonly T[]
  onToggle: (value: T) => void
}) {
  return (
    <section>
      <h3>{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <li key={value}>
            <Chip isSelected={selected.includes(value)} onClick={() => onToggle(value)}>
              {labelOf(value)}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 필터 패널 (`DESIGN.md` 「화면 보조 패널」). **`compact`·`medium`에서는 전체 화면 시트,
 * `expanded`에서는 좌측 320px 상시 패널이고 내용은 같다** — 담는 그릇만 다르다. 그릇 전환은
 * `.filter-panel`이 맡는다 (`global.css`).
 *
 * 그릇에 딸린 차이가 하나 있다. **시트는 닫아야 결과를 보므로 닫는 동작에 개수를 실어 주고**
 * (「N문제 보기」), 상시 패널은 바로 반영되므로 `body-small`로 개수만 적는다. 「모두 해제」
 * 외의 적용 버튼을 두지 않는다.
 *
 * 서비스는 검색 입력이 컨트롤이다. 136개를 칩으로 늘어놓을 수 없고, 입력 글자는
 * **`body-large`(16px)여야 한다** — 그 미만이면 iOS Safari가 포커스에서 화면을 확대한다.
 */
export function FilterPanel({
  options,
  filter,
  matchCount,
  isOpen,
  onChange,
  onClose,
}: {
  options: { categories: string[]; services: string[] }
  filter: QuestionFilter
  matchCount: number
  isOpen: boolean
  onChange: (filter: QuestionFilter) => void
  onClose: () => void
}) {
  const [serviceSearch, setServiceSearch] = useState('')

  const searched = serviceSearch.trim().toLowerCase()
  const matchedServices = searched
    ? options.services.filter((service) => service.toLowerCase().includes(searched))
    : []

  // 검색하지 않을 때는 고른 것만 보인다 — 136개를 늘어놓지 않는다 (`DESIGN.md` 「필터 패널」).
  const shownServices = searched ? matchedServices : filter.services

  return (
    <div className={`filter-panel bg-surface-container-low ${isOpen ? '' : 'filter-panel-closed'}`}>
      {/* 시트에만 있는 헤더. 상시 패널에서는 그룹 제목이 이미 구조를 나른다. */}
      <div className="filter-panel-header flex h-14 items-center gap-2 expanded:hidden">
        <button
          type="button"
          aria-label="필터 닫기"
          onClick={onClose}
          className="state-layer flex size-12 shrink-0 items-center justify-center rounded-corner-full"
        >
          <MaterialSymbol name="arrow_back" />
        </button>
        <h2 className="flex-1 truncate text-label-large">필터</h2>
        {hasActiveFilter(filter) && <Button onClick={() => onChange(NO_FILTER)}>모두 해제</Button>}
      </div>

      <div className="flex flex-col gap-6 p-screen expanded:p-6">
        <ChipGroup
          title="카테고리"
          values={options.categories}
          labelOf={(category) => category}
          selected={filter.categories}
          onToggle={(category) =>
            onChange({ ...filter, categories: toggleValue(filter.categories, category) })
          }
        />

        <section>
          <h3>서비스</h3>
          <input
            type="search"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
            placeholder="서비스 이름"
            aria-label="서비스 검색"
            className="mt-2 h-12 w-full rounded-corner-extra-small border border-outline bg-surface px-4 text-body-large"
          />
          <ul className="mt-2 flex flex-wrap gap-2">
            {shownServices.map((service) => (
              <li key={service}>
                <Chip
                  isSelected={filter.services.includes(service)}
                  onClick={() =>
                    onChange({ ...filter, services: toggleValue(filter.services, service) })
                  }
                >
                  {service}
                </Chip>
              </li>
            ))}
          </ul>
        </section>

        <ChipGroup
          title="정답 개수"
          values={['single', 'multiple'] as const}
          labelOf={(kind) => ANSWER_COUNT_LABEL[kind]}
          selected={filter.answerCounts}
          onToggle={(kind) =>
            onChange({ ...filter, answerCounts: toggleValue(filter.answerCounts, kind) })
          }
        />

        <ChipGroup
          title="풀이 상태"
          values={['unsolved', 'wrong', 'correct'] as const}
          labelOf={(state) => SOLVE_STATE_LABEL[state]}
          selected={filter.solveStates}
          onToggle={(state) =>
            onChange({ ...filter, solveStates: toggleValue(filter.solveStates, state) })
          }
        />

        {/* 시트는 닫는 동작에 개수를 싣고, 상시 패널은 개수만 적는다. */}
        <Button
          variant="filled"
          onClick={onClose}
          className="filter-panel-apply w-full expanded:hidden"
        >
          {matchCount}문제 보기
        </Button>
        <p className="filter-panel-count hidden text-body-small text-on-surface-variant expanded:block">
          {matchCount}문제
        </p>
      </div>
    </div>
  )
}
