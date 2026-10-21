import { cx, Icon, type ButtonBase, type TextButtonSize } from '@scent-jo/react'
import type { IconName } from '@scent-jo/css'
import Link from 'next/link'
import type { ComponentProps } from 'react'

type LinkProps = Omit<ComponentProps<typeof Link>, 'color'>

/*
 * DS `Button`·`TextButton`·`IconButton`의 링크판이다. DS는 `href`를 받으면 평범한 `<a>`를 그려
 * 화면을 옮길 때마다 문서를 통째로 다시 받는다 — 쿼리 캐시가 버려지고 `AuthGuard`의 세션
 * 확인이 처음부터 돈다. 그래서 Next `Link`에 DS 마크업(`MARKUP.md` §8·§13)을 그대로 입힌다.
 *
 * ponytail: DS 마크업을 손으로 옮겼다. DS가 마크업을 바꾸면 이 파일이 낡는다 — DS가 링크
 * 컴포넌트 주입을 받으면(scent-jo-ds#18) 이 파일을 지우고 DS 컴포넌트에 `Link`를 넘긴다.
 */

export function LinkButton({
  color = 'primary',
  variant = 'fill',
  size = 'xlarge',
  display = 'inline',
  className,
  children,
  ...props
}: LinkProps & Pick<ButtonBase, 'color' | 'variant' | 'size' | 'display'>) {
  return (
    <Link
      {...props}
      className={cx('sj-button', 'sj-pressable', className)}
      data-sj-color={color}
      data-sj-variant={variant}
      data-sj-size={size}
      data-sj-display={display === 'inline' ? undefined : display}
    >
      <span className="sj-button__label">{children}</span>
    </Link>
  )
}

export function LinkTextButton({
  size,
  className,
  children,
  ...props
}: LinkProps & { size: TextButtonSize }) {
  return (
    <Link
      {...props}
      className={cx('sj-text-button', className)}
      data-sj-size={size}
      data-sj-variant="clear"
      data-sj-haptic="tickWeak"
    >
      <span className="sj-text-button__label">{children}</span>
    </Link>
  )
}

/** 아이콘만으로는 역할을 알 수 없어 `aria-label`이 필수다 (DS `IconButton`과 같다). */
export function LinkIconButton({
  icon,
  className,
  ...props
}: LinkProps & { icon: IconName; 'aria-label': string }) {
  return (
    <Link
      {...props}
      className={cx('sj-icon-button', 'sj-pressable', className)}
      data-sj-variant="clear"
      data-sj-size="large"
      data-sj-haptic="tickWeak"
    >
      <Icon name={icon} />
    </Link>
  )
}
