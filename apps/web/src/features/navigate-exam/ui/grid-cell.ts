import type { CSSProperties } from 'react'

/**
 * 진행 중 그리드와 결과 그리드가 나눠 쓰는 칸 규격 (`DESIGN.md` 「문제 이동 그리드」).
 *
 * **열 수를 고정하지 않는다. 폭이 정한다** — 규칙은 칸 크기이고 열 수는 그 결과다. 칸은 DS
 * Button `large`(높이 `x12` · `radius-3` · `t5`)를 따르고, 같은 `x12`를 칸의 최소 폭으로 건다.
 */
export const GRID_STYLE: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(var(--sj-dimension-x12), 1fr))',
}

/**
 * 눌림은 `sj-pressable`(축소)이다. `sj-pressed-overlay`는 `:active` 배경이 components 층이라
 * 채운 칸의 `bg-*` 유틸에 가려 그려지지 않는다.
 */
export const CELL_BASE_CLASS =
  'sj-pressable flex h-12 w-full items-center justify-center rounded-3 text-t5'
