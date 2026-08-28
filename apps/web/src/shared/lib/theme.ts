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
}
