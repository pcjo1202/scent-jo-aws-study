import { Icon } from '@scent-jo/react'

/**
 * 채점 결과를 지문 위에 한 줄로 알린다 (`DESIGN.md` 「채점 결과 · 결과 배너」).
 * 시스템 상태를 알리는 `StatusBanner`와 다른 컴포넌트다 — `success`·`danger`는 채점 결과(이 배너와
 * 채점된 선택지)에만 쓴다 (「색 사용 규칙」). 색을 걷어내도 아이콘과 문구가 정오를 나른다.
 *
 * `isCorrect`는 서버 판정이다. 화면이 정답을 대조하지 않는다 (루트 `CLAUDE.md`).
 *
 * **전환 애니메이션 없이 즉시 나타난다** — 1019번 반복할 화면이 바뀌기를 기다리게 하지 않는다
 * (`DESIGN.md` 「채점 결과 · 결과 배너」).
 */
export function ResultBanner({ isCorrect }: { isCorrect: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 rounded-3 px-4 py-3 text-t5 font-semibold ${isCorrect ? 'bg-success-weak' : 'bg-danger-weak'}`}
    >
      <Icon
        name={isCorrect ? 'check' : 'close'}
        className={isCorrect ? 'text-success' : 'text-danger'}
      />
      {isCorrect ? '정답' : '오답'}
    </p>
  )
}
