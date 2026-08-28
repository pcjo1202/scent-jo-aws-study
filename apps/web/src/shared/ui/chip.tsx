import type { ComponentProps } from 'react'

/** 선택된 상태는 필터 칩에만 쓴다 (`DESIGN.md` 「칩」). 카테고리 칩에는 색을 쓰지 않는다. */
const CHIP_SURFACE = {
  default: 'bg-surface-container-high text-on-surface-variant',
  selected: 'bg-secondary-container text-on-secondary-container',
} as const

/**
 * 카테고리 라벨·등장 서비스·필터에 쓴다.
 *
 * 시각 높이 32px과 터치 영역 48px은 충돌이 아니라 **분리**다 — 넓히는 것은 `.chip::after`가
 * 맡는다 (`global.css`). 칩 자체를 48px로 키우면 카테고리 라벨이 본문을 밀어낸다.
 */
export function Chip({
  isSelected = false,
  className,
  ...props
}: ComponentProps<'button'> & { isSelected?: boolean }) {
  return (
    <button
      type="button"
      className={`chip state-layer inline-flex items-center gap-1 rounded-corner-full px-3 text-label-medium ${CHIP_SURFACE[isSelected ? 'selected' : 'default']} ${className ?? ''}`}
      {...props}
    />
  )
}
