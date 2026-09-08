import type { Comparison, ComparisonMember } from '@aws-study/shared'

import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

const SIGNAL_LABEL = {
  selectSignals: '선택 신호',
  rejectSignals: '탈락 신호',
  keyDifference: '결정적 차이',
} as const satisfies Record<Exclude<keyof ComparisonMember, 'name'>, string>

const SIGNAL_FIELDS = ['selectSignals', 'rejectSignals', 'keyDifference'] as const

/**
 * 비교노트 — 쌍마다 접힌 아코디언이다 (`docs/02-features.md` 「비교노트」).
 *
 * 본문이 21,554자·580문단이라 전부 펼쳐 두면 위에 선 한줄노트까지 더해 스크롤이 두 배가 된다.
 * **새 상호작용 패턴이 아니다** — 「③ 오답 해설」이 같은 이유로 이미 네이티브 `<details>`이고
 * (`DESIGN.md` 「해설 블록」), 여기서는 헤더가 선택지 카드 대신 비교쌍 카드일 뿐이다.
 */
export function ComparisonList({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {comparisons.map((comparison) => (
        // `title`이 48개 중 유일해 식별자다. `id`를 두지 않은 이유는 `docs/04` 「comparisons.json」.
        <li key={comparison.title}>
          <ComparisonCard comparison={comparison} />
        </li>
      ))}
    </ul>
  )
}

function ComparisonCard({ comparison }: { comparison: Comparison }) {
  return (
    <details className="disclosure group rounded-corner-medium border border-outline bg-surface-container-low">
      <summary className="state-layer flex min-h-12 cursor-pointer items-center gap-3 rounded-corner-medium px-4 py-3">
        <span className="flex-1 text-title-small">{comparison.title}</span>
        <Importance value={comparison.importance} />
        <MaterialSymbol name="expand_more" className="size-6 shrink-0 group-open:rotate-180" />
      </summary>

      <ul className="flex flex-col gap-4 px-4 pb-3">
        {/* 이름은 쌍 안에서 유일하다 — 48쌍 전수 확인 (2026-09-09). */}
        {comparison.members.map((member) => (
          <li key={member.name}>
            <p className="text-label-large">{member.name}</p>
            <dl className="mt-1 flex flex-col gap-1 text-body-medium">
              {SIGNAL_FIELDS.map((field) => (
                <div key={field} className="flex gap-2">
                  <dt className="shrink-0 text-on-surface-variant">{SIGNAL_LABEL[field]}</dt>
                  <dd>{member[field]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * **색을 쓰지 않는다. ★ 문자 그대로 1~3개다** (`DESIGN.md` 「색 사용 규칙」).
 *
 * 별을 하나씩 요소로 쪼개지 않고 문자열 하나로 두고, 스크린리더에는 별 문자 대신 숫자를
 * 읽힌다 — `★★★`는 낭독기마다 「블랙 스타 블랙 스타…」가 되거나 아무것도 안 읽힌다.
 */
function Importance({ value }: { value: number }) {
  return (
    <span className="shrink-0 text-label-medium text-on-surface-variant">
      <span aria-hidden>{'★'.repeat(value)}</span>
      <span className="sr-only">중요도 {value}</span>
    </span>
  )
}
