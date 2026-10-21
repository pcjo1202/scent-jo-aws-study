import type { ComponentProps } from 'react'

/** 누를 수 있는 칩과 누를 수 없는 칩이 같은 모양이어야 한 줄에 섞여도 리듬이 안 깨진다. */
const CHIP_BASE = 'inline-flex h-8 items-center gap-1 rounded-full px-3 text-t6'

/**
 * DS에 칩이 없어 DS 토큰으로 짓는다. 카테고리 라벨·등장 서비스·필터에 쓴다.
 *
 * 선택 상태는 켜고 끄는 칩(필터·「안 푼 문제 우선」)에만 쓴다. 펼치는 칩(한줄노트)에는 쓰지 않는다
 * (`DESIGN.md` 「칩」). 선택은 정오가 아니라 brand다.
 */
export function Chip({
  isSelected = false,
  className,
  ...props
}: ComponentProps<'button'> & { isSelected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={`${CHIP_BASE} sj-pressable ${isSelected ? 'bg-brand-weak text-brand' : 'bg-subtle text-secondary'} ${className ?? ''}`}
      {...props}
    />
  )
}

/**
 * 누를 수 없는 칩. 지금 걸린 필터의 표시나 한줄노트가 없는 서비스처럼 **보여 주기만** 하는 자리다 —
 * 버튼으로 두면 눌러도 아무 일이 없다.
 */
export function ChipLabel({ className, ...props }: ComponentProps<'span'>) {
  return <span className={`${CHIP_BASE} bg-subtle text-secondary ${className ?? ''}`} {...props} />
}
