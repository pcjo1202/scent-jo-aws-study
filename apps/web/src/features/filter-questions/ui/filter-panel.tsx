'use client'

import { useState } from 'react'

import {
  ANSWER_COUNT_LABEL,
  FILTER_GROUPS,
  hasActiveFilter,
  NO_FILTER,
  SOLVE_STATE_LABEL,
  type AnswerCountKind,
  type FilterGroup,
  type QuestionFilter,
  type SolveState,
} from '@/shared/lib/question-filter'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { SidePanel } from '@/shared/ui/side-panel'

const ANSWER_COUNT_VALUES = ['single', 'multiple'] as const satisfies readonly AnswerCountKind[]
const SOLVE_STATE_VALUES = ['unsolved', 'wrong', 'correct'] as const satisfies readonly SolveState[]

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
 * 필터 패널의 **내용** (`DESIGN.md` 「화면 보조 패널」). 시트↔상시 패널 전환과 `dialog` 기계는
 * `SidePanel`이 맡는다 — `/exam/[id]`의 문제 이동 그리드가 같은 그릇을 쓴다.
 *
 * 그릇에 딸린 차이는 **「모두 해제」의 자리**와 **하단 표현** 둘이다 (`DESIGN.md` 표) — 시트는
 * 헤더 우측에 두고 닫는 동작에 개수를 실어 주며(「N문제 보기」), 상시 패널은 바로 반영되므로
 * 하단 개수 줄 우측에 두고 `body-small`로 개수만 적는다. 적용 버튼은 그 밖에 두지 않는다.
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
  shownGroups = FILTER_GROUPS,
}: {
  options: { categories: string[]; services: string[] }
  filter: QuestionFilter
  matchCount: number
  isOpen: boolean
  onChange: (filter: QuestionFilter) => void
  onClose: () => void
  /** 기본은 넷 전부(`/study`). `/review`는 `['categories']`를 준다. */
  shownGroups?: readonly FilterGroup[]
}) {
  const [serviceSearch, setServiceSearch] = useState('')

  const searched = serviceSearch.trim().toLowerCase()

  // 검색하지 않을 때는 고른 것만 보인다 — 136개를 늘어놓지 않는다 (`DESIGN.md` 「필터 패널」).
  const shownServices = searched
    ? options.services.filter((service) => service.toLowerCase().includes(searched))
    : filter.services

  const clearButton = hasActiveFilter(filter) ? (
    <Button onClick={() => onChange(NO_FILTER)}>모두 해제</Button>
  ) : null

  return (
    <SidePanel label="필터" isOpen={isOpen} onClose={onClose} headerAction={clearButton}>
      {shownGroups.includes('categories') && (
        <ChipGroup
          title="카테고리"
          values={options.categories}
          labelOf={(category) => category}
          selected={filter.categories}
          onToggle={(category) =>
            onChange({ ...filter, categories: toggleValue(filter.categories, category) })
          }
        />
      )}

      {shownGroups.includes('services') && (
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
      )}

      {shownGroups.includes('answerCounts') && (
        <ChipGroup
          title="정답 개수"
          values={ANSWER_COUNT_VALUES}
          labelOf={(kind) => ANSWER_COUNT_LABEL[kind]}
          selected={filter.answerCounts}
          onToggle={(kind) =>
            onChange({ ...filter, answerCounts: toggleValue(filter.answerCounts, kind) })
          }
        />
      )}

      {shownGroups.includes('solveStates') && (
        <ChipGroup
          title="풀이 상태"
          values={SOLVE_STATE_VALUES}
          labelOf={(state) => SOLVE_STATE_LABEL[state]}
          selected={filter.solveStates}
          onToggle={(state) =>
            onChange({ ...filter, solveStates: toggleValue(filter.solveStates, state) })
          }
        />
      )}

      <Button variant="filled" onClick={onClose} className="w-full expanded:hidden">
        {matchCount}문제 보기
      </Button>

      {/* 상시 패널의 하단 줄 — 개수 좌측, 「모두 해제」 우측 (`DESIGN.md` 「화면 보조 패널」 표). */}
      <div className="hidden items-center justify-between gap-4 expanded:flex">
        <p className="text-body-small text-on-surface-variant">{matchCount}문제</p>
        {clearButton}
      </div>
    </SidePanel>
  )
}
