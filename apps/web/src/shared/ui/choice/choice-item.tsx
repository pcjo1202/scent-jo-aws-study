'use client'

import type { ChoiceKey } from '@aws-study/shared'

import { isSingleAnswer } from '@/shared/lib/choice-selection'

/**
 * 선택지 하나. 카드 전체가 클릭 영역이라 `label`이 카드이고 그 안에 네이티브 `input`이 있다
 * (`DESIGN.md` 「선택지」). 표식을 직접 그리지 않는 이유는 `radio`가 원형, `checkbox`가
 * 사각이라 모양이 이미 맞고 키보드·스크린리더 노출이 공짜로 따라오기 때문이다.
 *
 * 선택 여부는 **배경**이 나른다. 테두리는 선택과 무관하게 `outline`이다 —
 * `surface-container-low`가 `surface` 대비 1.05라 카드 경계가 그 선 하나에 걸려 있다
 * (`DESIGN.md` 「대비 검증」 § 각주).
 *
 * `whitespace-pre-wrap`이 필요하다. IAM 정책 JSON이 든 문항 7개의 선택지에 줄바꿈이 살아 있고
 * 한 줄로 접으면 읽을 수 없다 (`docs/04-data-model.md` 「파서가 복원할 수 없는 것」).
 */
export function ChoiceItem({
  choiceKey,
  text,
  order,
  groupName,
  answerCount,
  isSelected,
  isDisabled,
  onToggle,
}: {
  choiceKey: ChoiceKey
  text: string
  order: number
  groupName: string
  answerCount: number
  isSelected: boolean
  isDisabled: boolean
  onToggle: (key: ChoiceKey) => void
}) {
  const surfaceClass = isSelected
    ? 'bg-secondary-container text-on-secondary-container'
    : 'bg-surface-container-low text-on-surface'

  return (
    <label
      aria-disabled={isDisabled}
      className={`choice-card state-layer cursor-pointer border border-outline ${surfaceClass}`}
    >
      <input
        type={isSingleAnswer(answerCount) ? 'radio' : 'checkbox'}
        name={groupName}
        value={choiceKey}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => onToggle(choiceKey)}
        className="mt-1 accent-primary"
      />
      <span>{choiceKey}</span>
      <span className="flex-1 whitespace-pre-wrap">{text}</span>
      <span className="key-hint text-label-medium text-on-surface-variant">{order}</span>
    </label>
  )
}
