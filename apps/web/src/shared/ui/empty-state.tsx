import type { ReactNode } from 'react'

/**
 * 빈 상태와 완주 화면 (`DESIGN.md` 「빈 상태」). 문구는 `docs/02-features.md` 「빈 상태」가
 * 정본이고 여기서는 그리는 법만 정한다.
 *
 * **`error`를 쓰지 않는다.** 빈 상태는 오류가 아니다 — 「복습할 오답이 없다」에 경고색을
 * 쓰면 0건이 실패로 읽힌다.
 *
 * **일러스트도 설명 문장도 없다.** 한 줄과 버튼이면 무엇을 할지가 정해진다.
 *
 * 하단 액션 바가 없는 화면이므로(제출할 문제가 없다) 본문 영역이 화면 전체이고, 가운데
 * 정렬의 가운데가 그 영역의 가운데다 (`DESIGN.md` 「빈 상태·완주에서 골격은 어떻게 되나」).
 */
export function EmptyState({ message, actions }: { message: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-screen py-6 text-center">
      <p className="text-title-medium">{message}</p>
      {actions && <div className="flex flex-col items-center gap-2">{actions}</div>}
    </div>
  )
}
