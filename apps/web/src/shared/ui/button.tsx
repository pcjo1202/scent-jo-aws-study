import type { ComponentProps } from 'react'

/** `DESIGN.md` 「하단 액션 바」의 주 버튼 / 보조 버튼. 둘 다 `corner-full`·`label-large`다. */
const VARIANT_CLASS = {
  filled: 'bg-primary text-on-primary',
  text: 'text-primary',
} as const

/**
 * 탭 타깃 48×48px는 `global.css`의 base 레이어가 모든 `button`에 이미 걸어 뒀다.
 * 여기서 다시 지정하지 않는다.
 *
 * **56px을 여기 두지 않는다.** `DESIGN.md`가 그 높이를 준 곳은 「하단 액션 바」의 주·보조
 * 버튼과 대시보드의 이어풀기이지 모든 버튼이 아니다 — 여기 걸면 최소 높이 48px인 상태 배너의
 * 「다시 시도」까지 56px이 되어 배너 한 줄이 밀린다 (`DESIGN.md` 「상태 배너」). 액션 바의
 * 높이는 `.action-bar`가 준다.
 */
export function Button({
  variant = 'text',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof VARIANT_CLASS }) {
  return (
    <button
      type="button"
      className={`state-layer inline-flex items-center justify-center gap-2 rounded-corner-full px-6 text-label-large ${VARIANT_CLASS[variant]} ${className ?? ''}`}
      {...props}
    />
  )
}
