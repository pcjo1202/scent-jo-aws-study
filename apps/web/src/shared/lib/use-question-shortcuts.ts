'use client'

import { useEffect } from 'react'

import type { ChoiceKey } from '@aws-study/shared'

/**
 * `DESIGN.md` 「선택지 · 키보드」의 표 그대로다. 도움말 다이얼로그가 이 배열을 그리므로
 * 단축키 목록이 두 곳에 생기지 않는다.
 */
export const QUESTION_SHORTCUT_HELP = [
  { keys: '1 ~ 6', description: '선택지 고르기' },
  { keys: 'Enter', description: '제출 / 다음' },
  { keys: '← →', description: '이전 / 다음 문제' },
  { keys: '?', description: '단축키 도움말' },
] as const

const DIGIT_PATTERN = /^[1-9]$/

function isFormControl(target: EventTarget | null) {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * PC에서 1019문항을 마우스로만 푸는 것은 현실적이지 않다 (`docs/02-features.md`
 * 「키보드 조작」). 키보드는 1급 입력 수단이다.
 *
 * **숫자는 키가 아니라 순서에 붙는다.** `1`이 A인 것은 A가 첫 번째이기 때문이고, 선택지가
 * 6개면 `6`이 F를 고른다. 문항에 없는 번호는 아무 일도 하지 않는다.
 *
 * 선택 규칙을 여기서 다시 구현하지 않는다 — `onToggle`은 클릭이 부르는 것과 같은 핸들러이고,
 * 초과 선택은 그쪽의 `toggleChoice`가 막는다. 규칙이 두 벌이 되면 키보드로만 초과가 새어 나간다.
 *
 * `←`/`→`는 폼 컨트롤 안에서 넘긴다. 네이티브 라디오 그룹에서 방향키는 선택을 옮기는
 * 표준 동작이라, 여기서 가로채면 스크린리더 사용자가 선택지를 고를 방법을 잃는다.
 */
export function useQuestionShortcuts({
  choiceKeys,
  onToggle,
  onSubmit,
  onPrevious,
  onNext,
  onShowHelp,
}: {
  choiceKeys: ChoiceKey[]
  onToggle: (key: ChoiceKey) => void
  onSubmit: () => void
  onPrevious: () => void
  onNext: () => void
  onShowHelp: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // 브라우저·OS 단축키를 가로채지 않는다.
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (DIGIT_PATTERN.test(event.key)) {
        const choiceKey = choiceKeys[Number(event.key) - 1]
        if (!choiceKey) return

        event.preventDefault()
        onToggle(choiceKey)
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        onShowHelp()
        return
      }

      // Enter가 버튼이나 입력에 이미 닿았으면 그쪽이 처리한다. 가로채면 한 번 누른 것이
      // 두 번 동작한다.
      if (event.key === 'Enter') {
        if (isFormControl(event.target) || event.target instanceof HTMLButtonElement) return

        event.preventDefault()
        onSubmit()
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (isFormControl(event.target)) return

        event.preventDefault()
        if (event.key === 'ArrowLeft') onPrevious()
        else onNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [choiceKeys, onToggle, onSubmit, onPrevious, onNext, onShowHelp])
}
