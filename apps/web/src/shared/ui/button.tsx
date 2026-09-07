import type { ComponentProps } from 'react'

/**
 * `DESIGN.md` 「하단 액션 바」. 셋 다 `corner-full`·`label-large`다.
 *
 * `tonal`은 **하단 액션 바의 보조 버튼 전용**이다 — 그 바는 배경이 없어 스크롤 중인 본문이
 * 버튼 뒤로 지나가는데, `primary` 채움인 주 버튼은 버티지만 면색 없는 글자는 겹치면 둘 다
 * 못 읽는다 (2026-09-07 실화면 판정, SJO-20). `text`를 전역으로 바꾸지 않는 이유는 상태
 * 배너의 「다시 시도」가 이미 `surface-container` 위에 있어 면색이 같아지기 때문이다.
 */
const VARIANT_CLASS = {
  filled: 'bg-primary text-on-primary',
  tonal: 'bg-surface-container text-primary',
  text: 'text-primary',
} as const

type ButtonVariant = keyof typeof VARIANT_CLASS

const SHAPE_CLASS =
  'state-layer inline-flex items-center justify-center gap-2 rounded-corner-full px-6 text-label-large'

/**
 * 링크를 버튼처럼 그려야 하는 자리가 있다 — 빈 상태의 「오답 복습」·「모의고사」가 그렇다.
 * `asChild` 같은 장치를 들이는 대신 클래스만 내보낸다.
 *
 * **`min-h-12`는 여기에만 있다.** base 레이어의 탭 타깃 하한은 `button`에만 걸려 있어 `a`가
 * 못 받기 때문인데, `Button`에까지 붙이면 그 유틸이 `.action-bar > button`의 56px을 이긴다 —
 * utilities 레이어가 components보다 뒤다.
 */
export function buttonClassName(variant: ButtonVariant = 'text'): string {
  return `${SHAPE_CLASS} min-h-12 ${VARIANT_CLASS[variant]}`
}

/**
 * **56px을 여기 두지 않는다.** `DESIGN.md`가 그 높이를 준 곳은 「하단 액션 바」의 주·보조
 * 버튼과 대시보드의 이어풀기이지 모든 버튼이 아니다 — 여기 걸면 최소 높이 48px인 상태 배너의
 * 「다시 시도」까지 56px이 되어 배너 한 줄이 밀린다 (`DESIGN.md` 「상태 배너」). 액션 바의
 * 높이는 `.action-bar`가 준다.
 */
export function Button({
  variant = 'text',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`${SHAPE_CLASS} ${VARIANT_CLASS[variant]} ${className ?? ''}`}
      {...props}
    />
  )
}
