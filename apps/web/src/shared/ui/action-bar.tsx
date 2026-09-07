import type { ReactNode } from 'react'

/**
 * 제출·이전·다음이 놓이는 자리. `compact`에서 화면 하단에 고정되고 `expanded`에서는 읽기
 * 칼럼 하단의 문서 흐름 안으로 돌아온다 — 위치와 높이는 `.action-bar`가 맡는다 (`global.css`).
 *
 * **바가 아니라 버튼만 뜬다 — 배경도 상단 경계선도 없다** (`DESIGN.md` 「하단 액션 바」).
 * 그래서 본문 마지막 블록이 버튼 뒤에 영구히 깔릴 수 있고, 그것을 `.action-bar-gutter`가
 * 받는다. 둘은 짝이므로 한쪽만 쓰지 않는다.
 *
 * 버튼을 이 컴포넌트가 정하지 않는다. 모드마다 다르기 때문이다 — `/study`는 제출 후 「다음」이
 * 되고 `/exam`은 채점 없이 문제 사이를 오간다 (`docs/02-features.md` 「모드별 차이」).
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="action-bar flex items-center justify-end gap-4 px-screen">{children}</div>
  )
}
