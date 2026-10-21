import { Icon } from '@scent-jo/react'
import Link from 'next/link'
import type { ReactNode } from 'react'

/*
 * DS `ListRow`의 링크판이다. `ListRow`는 `li`·`div`만 그리고 누를 수 있게 하려면 `onClick`으로
 * `role="button"`을 단다 — 화면 이동이 버튼이 되면 새 탭 열기·주소 복사가 사라지고, 라우터를
 * 부르려고 `'use client'`가 번진다. 그래서 `LinkButton`처럼 Next `Link`에 DS 마크업
 * (`MARKUP.md` §14)을 그대로 입힌다. 포커스 링·눌림 효과는 루트 클래스에 DS CSS가 건다.
 *
 * 부르는 쪽이 `<li>`로 감싼다 — 이 컴포넌트는 링크 하나다.
 *
 * ponytail: DS 마크업을 손으로 옮겼다. DS가 마크업을 바꾸면 이 파일이 낡는다 — DS가 링크
 * 컴포넌트 주입을 받으면(scent-jo-ds#18) 이 파일을 지우고 `ListRow`에 `Link`를 넘긴다.
 */
export function LinkListRow({
  href,
  contents,
  right,
}: {
  href: string
  contents: ReactNode
  right?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="sj-list-row"
      data-sj-border="none"
      data-sj-v-pad="medium"
      data-sj-h-pad="small"
      data-sj-a11y-right-reflow=""
      data-sj-reflow={right == null ? undefined : ''}
      data-sj-touch=""
    >
      <span className="sj-list-row__container">
        <span className="sj-list-row__body">
          <span className="sj-list-row__contents">{contents}</span>
          {right != null && <span className="sj-list-row__right">{right}</span>}
        </span>
        <span className="sj-list-row__arrow">
          <Icon name="chevron-right" />
        </span>
      </span>
    </Link>
  )
}
