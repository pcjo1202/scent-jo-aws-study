import type { ComponentProps } from 'react'

/** `DESIGN.md` 「하단 액션 바」의 주 버튼 / 보조 버튼. 둘 다 `corner-full`·`label-large`다. */
const VARIANT_CLASS = {
  filled: 'bg-primary text-on-primary',
  text: 'text-primary',
} as const

/**
 * 탭 타깃 48×48px는 `global.css`의 base 레이어가 모든 `button`에 이미 걸어 뒀다.
 * 여기서 다시 지정하지 않는다.
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
