'use client'

import type { ChoiceKey } from '@aws-study/shared'

import { isSingleAnswer } from '@/shared/lib/choice-selection'
import { CHOICE_CARD_CLASS } from '@/shared/ui/choice/choice-card'

/**
 * 선택지 하나. 카드 전체가 클릭 영역이라 `label`이 카드이고 그 안에 네이티브 `input`이 있다
 * (`DESIGN.md` 「선택지」). 표식을 직접 그리지 않는 이유는 `radio`가 원형, `checkbox`가
 * 사각이라 모양이 이미 맞고 키보드·스크린리더 노출이 공짜로 따라오기 때문이다.
 *
 * 선택 여부는 **면색**이 나른다. 정오 색이 아니라 brand다 (`DESIGN.md` 「선택지 · 상태」).
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
  return (
    <label
      aria-disabled={isDisabled}
      className={`${CHOICE_CARD_CLASS} sj-pressed-overlay cursor-pointer border border-default aria-disabled:cursor-default aria-disabled:text-tertiary ${isSelected ? 'bg-brand-weak' : 'bg-default'}`}
    >
      <input
        type={isSingleAnswer(answerCount) ? 'radio' : 'checkbox'}
        name={groupName}
        value={choiceKey}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => onToggle(choiceKey)}
        className="mt-1.5"
        style={{ accentColor: 'var(--sj-color-bg-brand)' }}
      />
      <span>{choiceKey}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{text}</span>
      {/* 키 힌트는 폭과 포인터 두 조건이다 — 넓은 터치 태블릿에 단축키를 보여줄 이유가 없다
          (`DESIGN.md` 「선택지 · 키보드」). */}
      <span className="hidden text-t7 text-tertiary lg:[@media(hover:hover)]:inline">{order}</span>
    </label>
  )
}
