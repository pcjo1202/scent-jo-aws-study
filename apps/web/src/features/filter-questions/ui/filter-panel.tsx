'use client'

import { useEffect, useRef, useState } from 'react'

import {
  ANSWER_COUNT_LABEL,
  hasActiveFilter,
  NO_FILTER,
  SOLVE_STATE_LABEL,
  type AnswerCountKind,
  type QuestionFilter,
  type SolveState,
} from '@/shared/lib/question-filter'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/** `expanded` 상시 패널은 시트가 아니므로 `dialog`로 열지 않는다. 값은 `DESIGN.md` 「Layout」. */
const EXPANDED_BREAKPOINT = '(width >= 840px)'

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
 * 필터 패널 (`DESIGN.md` 「화면 보조 패널」). **`compact`·`medium`에서는 전체 화면 시트,
 * `expanded`에서는 좌측 320px 상시 패널이고 내용은 같다** — 담는 그릇만 다르다. 그릇 전환은
 * `.filter-panel`이 맡는다 (`global.css`).
 *
 * **시트는 네이티브 `dialog`의 `showModal()`로 연다.** 포커스 트랩·`Esc` 닫기·배경 비활성화를
 * 직접 구현하지 않으려는 것이 첫째이고, 둘째가 더 중요하다 — `useQuestionShortcuts`가 모달
 * 여부를 `closest('dialog[open]')` 하나로 판정하므로, 평범한 `div`로 두면 시트 안 칩에
 * 포커스가 있을 때 `←`·`→`가 **뒤 문항의 커서를 옮기고 선택과 채점 결과를 버린다.**
 *
 * `expanded`에서는 `showModal()`을 부르지 않는다. 상시 패널은 뒤 화면을 막지 않는다.
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
}: {
  options: { categories: string[]; services: string[] }
  filter: QuestionFilter
  matchCount: number
  isOpen: boolean
  onChange: (filter: QuestionFilter) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [serviceSearch, setServiceSearch] = useState('')

  /**
   * **폭 변화를 구독한다.** 모달로 연 `dialog`는 top-layer에 올라가 폭이 바뀌어도 모달인
   * 채로 남는다 — 시트로 열어 둔 상태에서 `expanded`로 넓히면 상시 패널 자리에 320px이
   * 아니라 화면 폭짜리 모달이 그대로 서 있다. 그릇이 바뀌면 닫아야 한다.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const expanded = window.matchMedia(EXPANDED_BREAKPOINT)

    function sync() {
      if (!dialog) return
      // 상시 패널은 흐름 안의 요소다. `showModal()`을 부르면 화면을 덮어 본문이 죽는다.
      if (expanded.matches) {
        if (dialog.open) dialog.close()
        return
      }

      if (isOpen && !dialog.open) dialog.showModal()
      if (!isOpen && dialog.open) dialog.close()
    }

    sync()
    expanded.addEventListener('change', sync)
    return () => expanded.removeEventListener('change', sync)
  }, [isOpen])

  const searched = serviceSearch.trim().toLowerCase()

  // 검색하지 않을 때는 고른 것만 보인다 — 136개를 늘어놓지 않는다 (`DESIGN.md` 「필터 패널」).
  const shownServices = searched
    ? options.services.filter((service) => service.toLowerCase().includes(searched))
    : filter.services

  const clearButton = hasActiveFilter(filter) ? (
    <Button onClick={() => onChange(NO_FILTER)}>모두 해제</Button>
  ) : null

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="필터"
      className="filter-panel bg-surface-container-low text-on-surface"
    >
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
        {clearButton}
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
          values={ANSWER_COUNT_VALUES}
          labelOf={(kind) => ANSWER_COUNT_LABEL[kind]}
          selected={filter.answerCounts}
          onToggle={(kind) =>
            onChange({ ...filter, answerCounts: toggleValue(filter.answerCounts, kind) })
          }
        />

        <ChipGroup
          title="풀이 상태"
          values={SOLVE_STATE_VALUES}
          labelOf={(state) => SOLVE_STATE_LABEL[state]}
          selected={filter.solveStates}
          onToggle={(state) =>
            onChange({ ...filter, solveStates: toggleValue(filter.solveStates, state) })
          }
        />

        <Button
          variant="filled"
          onClick={onClose}
          className="filter-panel-apply w-full expanded:hidden"
        >
          {matchCount}문제 보기
        </Button>

        {/* 상시 패널의 하단 줄 — 개수 좌측, 「모두 해제」 우측 (`DESIGN.md` 「화면 보조 패널」 표). */}
        <div className="hidden items-center justify-between gap-4 expanded:flex">
          <p className="text-body-small text-on-surface-variant">{matchCount}문제</p>
          {clearButton}
        </div>
      </div>
    </dialog>
  )
}
