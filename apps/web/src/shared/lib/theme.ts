import { type ColorMode, getColorMode, setColorMode } from '@scent-jo/css/color-mode'

/**
 * 색 모드 상태. 저장·`<html data-sj-color-mode>` 반영은 scent-jo-ds `color-mode`가 하고,
 * `system` 해석은 DS CSS(`prefers-color-scheme`)가 한다 — 여기는 3상태 저장과 구독만 맡는다.
 * 그래서 OS 설정이 바뀌어도 JS가 할 일이 없다.
 */

export const THEME_MODES = ['system', 'light', 'dark'] as const

export type ThemeMode = ColorMode

/**
 * `useSyncExternalStore`의 getSnapshot. `<html>` 속성을 읽는다 — 첫 페인트 전 스크립트가
 * 저장값을 검증해 이미 넣어 뒀으므로, 저장값이 쓰레기여도 여기서는 `system`이 나온다.
 */
export function readThemeMode(): ThemeMode {
  return getColorMode()
}

/** 서버에는 저장값이 없다. 첫 렌더를 `system`으로 맞춰 하이드레이션이 어긋나지 않게 한다. */
export function readServerThemeMode(): ThemeMode {
  return 'system'
}

let modeListeners: Array<() => void> = []

export function subscribeThemeMode(onStoreChange: () => void) {
  modeListeners = [...modeListeners, onStoreChange]

  return () => {
    modeListeners = modeListeners.filter((listener) => listener !== onStoreChange)
  }
}

/** 저장소 예외는 `setColorMode`가 삼킨다 — 저장에 실패해도 속성은 바뀐다. */
export function applyThemeMode(mode: ThemeMode) {
  setColorMode(mode)

  for (const listener of modeListeners) listener()
}
