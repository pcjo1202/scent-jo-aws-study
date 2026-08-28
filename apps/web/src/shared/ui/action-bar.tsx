import type { ReactNode } from 'react'

/**
 * 제출·이전·다음이 놓이는 자리. `compact`에서 화면 하단에 고정되고 `expanded`에서는 읽기
 * 칼럼 하단의 문서 흐름 안으로 돌아온다 — 위치 전환은 `.action-bar`가 맡는다 (`global.css`).
 *
 * 버튼을 이 컴포넌트가 정하지 않는다. 모드마다 다르기 때문이다 — `/study`는 제출 후 「다음」이
 * 되고 `/exam`은 채점 없이 문제 사이를 오간다 (`docs/02-features.md` 「모드별 차이」).
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="action-bar flex items-center justify-end gap-4 border-t border-outline-variant bg-surface-container px-screen py-2">
      {children}
    </div>
  )
}
