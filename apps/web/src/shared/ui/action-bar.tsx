import { ActionBar as DSActionBar } from '@scent-jo/react'
import type { ReactNode } from 'react'

/**
 * 제출·이전·다음이 놓이는 자리. `md` 미만에서 화면 하단에 붙고 `md` 이상에서는 읽기 칼럼 아래
 * 흐름 안으로 돌아온다 — DS `ActionBar`가 한다. **`main`의 마지막 자식**으로 둬야 sticky가 산다.
 *
 * 버튼은 **오른쪽으로 몬다** (`DESIGN.md` 「하단 액션의 버튼 배치」). DS 기본은 왼쪽 정렬이다.
 * 버튼을 이 컴포넌트가 정하지 않는 이유는 모드마다 달라서다 (`docs/02-features.md` 「모드별 차이」).
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return <DSActionBar className="justify-end">{children}</DSActionBar>
}
