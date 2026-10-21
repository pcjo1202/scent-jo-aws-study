import type { CSSProperties } from 'react'

/**
 * 진행 중 그리드와 결과 그리드가 나눠 쓰는 칸 규격 (`DESIGN.md` 「문제 이동 그리드」).
 *
 * **열 수를 고정하지 않는다. 폭이 정한다** — 규칙은 칸 크기이고 열 수는 그 결과다. 칸은 DS
 * Button `large`(높이 48px · `radius-3` · `t5`)를 따르고, 같은 48px(`x12`)를 칸의 최소 폭으로 건다.
 *
 * `pt-1`은 첫 줄 포커스 링 자리다. 링이 칸 밖 4px(두께 2 + 간격 2)에 그려지는데 시트 본문은
 * 스크롤 영역이라 위쪽 여백이 없으면 첫 줄의 링 윗변이 잘린다.
 */
export const GRID_STYLE: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fill, minmax(var(--sj-dimension-x12), 1fr))',
}

/**
 * 눌림은 `sj-pressable`(축소)이다. `sj-pressed-overlay`는 `:active` 배경이 components 층이라
 * 채운 칸의 `bg-*` 유틸에 가려 그려지지 않는다.
 */
export const GRID_CLASS = 'grid gap-2 pt-1'

export const CELL_BASE_CLASS =
  'sj-pressable flex h-12 w-full items-center justify-center rounded-3 text-t5'

/**
 * 「안 함」과 「미응답」은 두 표에서 같은 칸이다 — 채움 없음 · 얇은 테두리. 테두리가 `default`가
 * 아니라 `strong`인 이유는 시트·사이드바 면 위에서도 보여야 하기 때문이다.
 */
export const THIN_BORDER_CELL_CLASS = 'border border-strong text-secondary'
