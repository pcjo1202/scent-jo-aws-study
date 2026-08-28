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

const TEXT_INPUT_TYPES = ['text', 'search', 'email', 'number', 'password', 'tel', 'url']

/** 글자가 들어가는 자리. 여기서는 단축키를 하나도 가로채지 않는다. */
function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true

  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(target.type)
}

/** `Enter`가 이미 무언가를 여는 자리. 태그 목록이 아니라 "활성화되는 요소"로 잡는다. */
function isActivatable(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('a[href], button, summary') !== null
}

/** 라디오·체크박스에서 방향키는 선택을 옮기는 네이티브 동작이다. */
function isChoiceControl(target: EventTarget | null) {
  return target instanceof HTMLInputElement && ['radio', 'checkbox'].includes(target.type)
}

/** 모달이 떠 있으면 뒤 화면은 조작되지 않아야 한다. `showModal()`은 포커스만 가둔다. */
function isInsideModal(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('dialog[open]') !== null
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
 * **네이티브 동작을 이기지 않는다.** 문서 레벨 리스너의 `preventDefault()`는 어느 시점이든
 * 기본 동작을 취소하므로, 가로채는 자리를 좁게 잡지 않으면 같은 화면의 다른 부품이 죽는다 —
 * 라디오 그룹의 방향키(선택 이동), `summary`·링크의 `Enter`(펼침·이동)가 그렇다.
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

      // 이 둘은 키 종류를 가리지 않는다 — 도움말이 떠 있는데 뒤 문항이 넘어가거나,
      // 필터 입력에 `1`을 치는데 선택지가 토글되면 안 된다.
      if (isInsideModal(event.target) || isTextEntry(event.target)) return

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

      // Enter가 이미 무언가를 여는 자리면 그쪽이 처리한다. 문서 레벨 리스너의
      // `preventDefault()`는 dispatch 어느 시점이든 기본 동작을 취소하므로, 여기서 놓치면
      // 오답 해설 아코디언(`summary`)이 Enter로 열리지 않고 제출이 불린다.
      if (event.key === 'Enter') {
        if (isActivatable(event.target)) return

        event.preventDefault()
        onSubmit()
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (isChoiceControl(event.target)) return

        event.preventDefault()
        if (event.key === 'ArrowLeft') onPrevious()
        else onNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [choiceKeys, onToggle, onSubmit, onPrevious, onNext, onShowHelp])
}
