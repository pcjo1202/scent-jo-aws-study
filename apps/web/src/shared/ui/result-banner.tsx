import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/**
 * 채점 결과를 선택지 위에 한 줄로 알린다 (`DESIGN.md` 「채점 결과 · 결과 배너」).
 * 시스템 상태를 알리는 `StatusBanner`와 다른 컴포넌트다 — 초록·빨강은 여기만 쓴다.
 *
 * `isCorrect`는 서버 판정이다. 화면이 정답을 대조하지 않는다 (루트 `CLAUDE.md`).
 *
 * **전환 애니메이션 없이 즉시 나타난다** (`DESIGN.md` 「Motion」).
 */
export function ResultBanner({ isCorrect }: { isCorrect: boolean }) {
  const surface = isCorrect
    ? 'bg-correct-container text-on-correct-container'
    : 'bg-error-container text-on-error-container'

  return (
    <p
      className={`flex min-h-12 items-center gap-3 rounded-corner-medium px-4 py-3 text-title-small ${surface}`}
    >
      <MaterialSymbol name={isCorrect ? 'check_circle' : 'cancel'} />
      {isCorrect ? '정답' : '오답'}
    </p>
  )
}
