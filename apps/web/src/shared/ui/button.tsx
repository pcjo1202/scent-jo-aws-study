import type { ComponentProps } from 'react'

/** `DESIGN.md` 「하단 액션 바」의 주 버튼 / 보조 버튼. 둘 다 `corner-full`·`label-large`다. */
const VARIANT_CLASS = {
  filled: 'bg-primary text-on-primary',
  text: 'text-primary',
} as const

type ButtonVariant = keyof typeof VARIANT_CLASS

/**
 * 링크를 버튼처럼 그려야 하는 자리가 있다 — 빈 상태의 「오답 복습」·「모의고사」가 그렇다.
 * `asChild` 같은 장치를 들이는 대신 클래스만 내보낸다.
 *
 * `min-h-12`가 여기 있는 이유: base 레이어의 탭 타깃 하한은 `button`에만 걸려 있어 `a`는
 * 받지 못한다.
 */
export function buttonClassName(variant: ButtonVariant = 'text'): string {
  return `state-layer inline-flex min-h-12 items-center justify-center gap-2 rounded-corner-full px-6 text-label-large ${VARIANT_CLASS[variant]}`
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
    <button type="button" className={`${buttonClassName(variant)} ${className ?? ''}`} {...props} />
  )
}
