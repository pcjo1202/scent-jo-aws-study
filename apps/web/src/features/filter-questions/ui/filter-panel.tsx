'use client'

import { BottomSheet, TextButton } from '@scent-jo/react'
import { useState, type ReactNode } from 'react'

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
import { Chip } from '@/shared/ui/chip'
import { PanelSheet } from '@/shared/ui/panel-sheet'

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

/** `sheet`는 `lg` 미만의 시트, `sidebar`는 `lg` 이상의 AppShell 사이드바다. 화면이 둘 다 렌더한다. */
type PanelContainer =
  { container: 'sidebar' } | { container: 'sheet'; isOpen: boolean; onClose: () => void }

/**
 * 필터 패널 (`DESIGN.md` 「화면 보조 패널」). **내용은 같고 그릇만 다르다.**
 *
 * 그릇에 딸린 차이는 **「모두 해제」의 자리**와 **하단 표현** 둘이다 (`DESIGN.md` 표) — 시트는
 * 닫는 동작에 개수를 실어 주고(「N문제 보기」, 그 위에 「모두 해제」), 사이드바는 바로 반영되므로
 * 하단 개수 줄에 개수만 적고 우측에 「모두 해제」를 둔다. 적용 버튼은 그 밖에 두지 않는다.
 *
 * 서비스는 검색 입력이 컨트롤이다. 136개를 칩으로 늘어놓을 수 없고, 입력 글자는
 * **`body-large`(16px)여야 한다** — 그 미만이면 iOS Safari가 포커스에서 화면을 확대한다.
 */
export function FilterPanel({
  options,
  filter,
  matchCount,
  onChange,
  shownGroups = FILTER_GROUPS,
  ...panel
}: PanelContainer & {
  options: { categories: string[]; services: string[] }
  filter: QuestionFilter
  matchCount: number
  onChange: (filter: QuestionFilter) => void
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
    <TextButton size="medium" onClick={() => onChange(NO_FILTER)}>
      모두 해제
    </TextButton>
  ) : null

  const groups: ReactNode = (
    <>
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
    </>
  )

  if (panel.container === 'sidebar') {
    return (
      <section aria-label="필터" className="flex flex-col gap-6 p-6">
        {groups}
        {/* 하단 줄 — 개수 좌측, 「모두 해제」 우측 (`DESIGN.md` 「화면 보조 패널」 표). */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-t7 text-secondary">{matchCount}문제</p>
          {clearButton}
        </div>
      </section>
    )
  }

  return (
    <PanelSheet
      label="필터"
      isOpen={panel.isOpen}
      onClose={panel.onClose}
      cta={
        <BottomSheet.CTA topAccessory={clearButton} onClick={panel.onClose}>
          {matchCount}문제 보기
        </BottomSheet.CTA>
      }
    >
      {groups}
    </PanelSheet>
  )
}
