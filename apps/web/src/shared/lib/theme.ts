/**
 * 테마 상태의 SSOT. `layout.tsx`의 FOUC 방지 인라인 스크립트가 이 파일의 키와 해석 규칙을
 * 문자열로 심어 쓰므로, 값을 여기서만 정의한다.
 *
 * 저장하는 것은 3상태(`system`/`light`/`dark`)이고, `<html data-theme>`에 들어가는 것은
 * 해석된 2상태다. CSS가 `[data-theme='dark']` 한 블록만 갖는 이유가 이것이다 —
 * `prefers-color-scheme` 분기를 CSS와 스크립트 두 곳에 두면 매핑이 두 벌이 된다.
 */

export const THEME_STORAGE_KEY = 'aws-study-theme'

export const THEME_MODES = ['system', 'light', 'dark'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

/** `data-theme` 속성에 실제로 들어가는 값. `system`은 여기까지 오지 않는다. */
export type ResolvedTheme = 'light' | 'dark'

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value)
}

/**
 * `useSyncExternalStore`의 getSnapshot. 저장값은 브라우저에만 있으므로 서버 스냅샷과
 * 갈라진다 — 그래서 이 값을 `useState` + `useEffect`로 읽어오지 않는다. 이펙트에서
 * setState하면 마운트마다 연쇄 렌더가 생기고 `react-hooks/set-state-in-effect`가 잡는다.
 */
export function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    // 사파리 프라이빗·쿠키 차단에서 localStorage 접근 자체가 던진다.
    // 저장값을 못 읽어도 system으로 진행하면 되므로 여기서만 삼킨다.
    return 'system'
  }
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

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode

  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light'
}

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode)

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // 위와 같다. 저장에 실패해도 이번 세션의 테마는 이미 적용됐다.
  }

  for (const listener of modeListeners) listener()
}
