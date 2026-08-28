import type { ReactNode } from 'react'

import { MaterialSymbol, type MaterialSymbolName } from '@/shared/ui/icon/material-symbol'

/** `DESIGN.md` 「Components · 상태 배너」의 세 행. `unsaved`가 "저장 대기 N건"이다. */
type StatusKind = 'loading' | 'error' | 'unsaved'

// 로딩에 아이콘이 없는 이유는 「Styles · Icons」에 있다 — 회전하지 않는 스피너 글리프는
// 아무것도 나르지 않는다.
const KIND_ICON: Record<StatusKind, MaterialSymbolName | null> = {
  loading: null,
  error: 'error',
  unsaved: 'cloud_off',
}

/**
 * 로딩·오류·저장 대기를 한 줄로 알린다. 채점 결과의 `ResultBanner`와 다른 컴포넌트다.
 *
 * **`correct`·`error` 색을 쓰지 않는다.** 시스템 상태는 채점 결과가 아니다
 * (`DESIGN.md` 「색 사용 규칙」). 세 종류는 문구와 아이콘으로 갈린다.
 *
 * **`aria-live`를 여기 두지 않는다.** 이 배너는 상태가 바뀌는 그 순간 마운트되므로 늦다.
 * 라이브 리전은 항상 떠 있는 바깥 컨테이너가 갖는다 (`QueryBoundary`).
 *
 * `action`을 기본값으로 갖지 않는 이유: `docs/02-features.md` 「API 오류의 화면 표현」이
 * 403에는 재시도를 금지하고 404는 목록으로 돌려보내라고 한다. 배너가 「다시 시도」를 갖고
 * 있으면 그 분기가 불가능해진다.
 */
export function StatusBanner({
  kind,
  children,
  action,
}: {
  kind: StatusKind
  children: ReactNode
  action?: ReactNode
}) {
  const icon = KIND_ICON[kind]

  return (
    <div className="flex min-h-12 items-center gap-3 rounded-corner-medium bg-surface-container px-4 py-3 text-body-medium text-on-surface-variant">
      {icon && <MaterialSymbol name={icon} />}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  )
}
