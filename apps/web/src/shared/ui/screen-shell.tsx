import { AppBar, AppShell, ProgressBar, ReadingColumn } from '@scent-jo/react'
import type { CSSProperties, ReactNode } from 'react'

import { LinkIconButton } from '@/shared/ui/link-button'

const SAFE_AREA_TOP = 'var(--sj-safe-area-top, env(safe-area-inset-top))'

/*
 * 앱바 전체 높이(safe area + row + 진행 바 + 아래 테두리 1px). DS가 사이드바 시작 높이로 읽는
 * `--sj-app-shell-header-height`에 넣는다 — DS 기본값은 row + 1px만 세서 진행 바·safe area가
 * 있으면 사이드바가 앱바 밑으로 파고든다 (`MARKUP.md` 4-3). 진행 바는 `size="light"`라 높이가
 * DS `x0_5`다(scent-jo-ds#19). 사이드바가 없는 화면에서도 넣는다 — `ScreenFill`이 같은 값을 읽는다.
 */
const HEADER_HEIGHT = `calc(${SAFE_AREA_TOP} + var(--sj-size-app-bar) + 1px)`
const HEADER_WITH_PROGRESS_HEIGHT = `calc(${SAFE_AREA_TOP} + var(--sj-size-app-bar) + var(--sj-dimension-x0_5) + 1px)`

/**
 * 로그인 후 9화면과 not-found가 물려받는 골격 (`DESIGN.md` 「공통 헤더·네비게이션」).
 * `children`이 `main`에 그대로 들어간다 — 본문은 DS `ReadingColumn`, 하단 액션은 그 **형제이자
 * 마지막 자식**인 `ActionBar`로 화면이 넣는다(sticky 조건, `MARKUP.md` 4-4).
 *
 * **뒤로가기는 히스토리가 아니라 라우트가 정하는 고정 링크다.** 이 앱은 웹뷰에서도 열리는데
 * 거기엔 주소창도 브라우저 뒤로가기도 없어 이 자리가 유일한 이탈 경로다 — 진입 경로에 따라
 * 목적지가 달라지면 안 된다. 그래서 `router.back()`이 아니라 `href`를 받는다. 없으면 허브(`/`)다.
 *
 * `sidebar`는 「화면 보조 패널」의 `lg` 그릇이다. 전역 메뉴로 쓰지 않는다.
 */
export function ScreenShell({
  title,
  backHref,
  trailing,
  progress,
  sidebar,
  children,
}: {
  title: string
  backHref?: string
  /** 화면당 하나 (`DESIGN.md` 「화면별 우측 액션」). */
  trailing?: ReactNode
  /** 문제 풀이 3화면만. 빈 상태·완주에서는 넘기지 않는다 (「빈 상태·완주에서 골격은 어떻게 되나」). */
  progress?: { current: number; total: number }
  sidebar?: ReactNode
  children: ReactNode
}) {
  // 사용자 정의 속성은 `CSSProperties`에 없다
  const style = {
    '--sj-app-shell-header-height': progress ? HEADER_WITH_PROGRESS_HEIGHT : HEADER_HEIGHT,
  } as CSSProperties

  return (
    <AppShell
      sidebar={sidebar}
      style={style}
      appBar={
        <AppBar
          leading={
            backHref && <LinkIconButton href={backHref} icon="arrow-left" aria-label="뒤로" />
          }
          title={title}
          trailing={trailing}
        >
          {/* 진도에 정오 색을 싣지 않는다 — DS 기본(브랜드)을 그대로 쓴다 (「진행 표시」). */}
          {progress && (
            <ProgressBar
              value={progress.current}
              max={progress.total}
              size="light"
              aria-label="진행"
            />
          )}
        </AppBar>
      }
    >
      {children}
    </AppShell>
  )
}

/**
 * 화면 전체가 빈 상태일 때의 본문 칼럼. 앱바 아래 남은 높이를 채워 `EmptyState`가 그 영역의
 * 수직 가운데에 서게 한다 (`DESIGN.md` 「빈 상태」 표의 「정렬」 행). DS `AppShell`의 `main`이 남은
 * 높이를 채우지 않아 사이트가 잰다 (scent-jo-ds#19).
 *
 * 세로 여백을 이 칼럼에 주지 않는다 — DS 읽기 칼럼은 `content-box`라 여백이 높이에 더해져
 * 그만큼 스크롤이 생긴다. 위에 칩·배너가 오면 그 조각이 자기 여백을 갖는다.
 */
export function ScreenFill({ children }: { children: ReactNode }) {
  return (
    <ReadingColumn
      className="flex flex-col"
      style={{ minHeight: 'calc(100dvh - var(--sj-app-shell-header-height))' }}
    >
      {children}
    </ReadingColumn>
  )
}
