import Link from 'next/link'
import type { ReactNode } from 'react'

import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

const PERCENT = 100

/**
 * 로그인 후 8화면이 물려받는 골격 (`DESIGN.md` 「공통 헤더·네비게이션」).
 *
 * **뒤로가기는 히스토리가 아니라 라우트가 정하는 고정 링크다.** 이 앱은 웹뷰에서도 열리는데
 * 거기엔 주소창도 브라우저 뒤로가기도 없어 이 자리가 유일한 이탈 경로다 — 진입 경로에 따라
 * 목적지가 달라지면 안 된다. 그래서 `router.back()`이 아니라 `href`를 받는다.
 *
 * **`backHref`가 없는 것과 제목이 좌측 정렬인 것은 같은 사실이다** — 허브(`/`)뿐이고,
 * 뒤로가기가 없어 가운데 정렬의 기준이 사라지기 때문이다.
 *
 * 우측 48px은 액션이 없어도 자리를 비워 둔다. 제목이 밀리면 화면마다 가운데가 달라진다.
 */
export function AppBar({
  title,
  backHref,
  action,
  progress,
}: {
  title: string
  backHref?: string
  action?: ReactNode
  /** 없으면 진행 바 자리를 `outline-variant` 1px이 받는다 (빈 상태·완주가 그렇다). */
  progress?: { current: number; total: number }
}) {
  return (
    <header className="app-bar bg-surface">
      <div className="flex h-14 items-center">
        {backHref && (
          <Link
            href={backHref}
            aria-label="뒤로"
            className="state-layer flex size-12 shrink-0 items-center justify-center rounded-corner-full"
          >
            <MaterialSymbol name="arrow_back" />
          </Link>
        )}

        <h1
          className={
            backHref
              ? 'flex-1 truncate text-center text-label-large'
              : 'flex-1 truncate px-screen text-title-medium'
          }
        >
          {title}
        </h1>

        <div className="flex size-12 shrink-0 items-center justify-center">{action}</div>
      </div>

      {progress ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.current}
          className="h-1 bg-surface-container-high"
        >
          {/*
            진행률은 계산된 값이라 유틸 클래스로 쓸 수 없다. 막대에 색을 싣지 않는다 —
            `primary`로 칠하면 대시보드에서 카테고리 정답률 막대와 같은 형태로 나란히 서는데
            `primary`×`error`가 적록색약 식별 한계 아래다 (`DESIGN.md` 「진행 표시」).
          */}
          <div
            className="h-full bg-on-surface-variant"
            style={{ width: `${(progress.current / progress.total) * PERCENT}%` }}
          />
        </div>
      ) : (
        <div className="h-px bg-outline-variant" />
      )}
    </header>
  )
}
