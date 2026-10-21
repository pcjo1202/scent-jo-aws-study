import { Loader } from '@scent-jo/react'
import type { ReactNode } from 'react'

/** `DESIGN.md` 「상태 배너」의 세 행. `unsaved`가 "저장 대기 N건"이다. */
type StatusKind = 'loading' | 'error' | 'unsaved'

/**
 * 로딩·오류·저장 대기를 한 줄로 알린다. 채점 결과의 `ResultBanner`와 다른 컴포넌트다.
 * DS에 같은 그릇이 없어 DS 토큰으로 짓는다.
 *
 * **`success`·`danger` 색을 쓰지 않는다.** 시스템 상태는 채점 결과가 아니다
 * (`DESIGN.md` 「색 사용 규칙」). 세 종류는 문구로 갈린다 — 오류·오프라인에 맞는 DS 아이콘이
 * 없어 아이콘을 두지 않는다 (scent-jo-ds#17). 로딩만 DS `Loader`를 곁들이는데, 그 내장 낭독 「로딩 중」은
 * 용어표(「불러오는 중」) 위반이라 낭독에서 뺀다 — 문구가 이미 같은 것을 말한다.
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
  return (
    <div className="flex items-center gap-3 rounded-3 bg-subtle px-4 py-3 text-t6 text-secondary">
      {kind === 'loading' && <Loader size="small" aria-hidden />}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  )
}
