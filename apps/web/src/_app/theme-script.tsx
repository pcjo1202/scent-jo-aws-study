import { DARK_SCHEME_QUERY, THEME_MODES, THEME_STORAGE_KEY } from '@/shared/lib/theme'

/**
 * 첫 페인트 전에 `<html data-theme>`을 확정한다. body 첫 자식의 동기 스크립트라 본문 마크업이
 * 파싱되기 전에 실행되고, 하이드레이션을 기다리지 않으므로 라이트 화면이 번쩍이지 않는다.
 * `<head>`에 두면 React가 "scripts inside React components are never executed when rendering
 * on the client"를 경고한다 — 렌더 블로킹 스타일시트 뒤라 실행 시점은 어차피 같다.
 *
 * 여기서 `system`을 light/dark로 해석하기 때문에 CSS는 `[data-theme='dark']` 한 블록만 갖는다.
 *
 * **저장값 검증을 `theme.ts`와 같은 목록으로 한다.** 이 스크립트가 화이트리스트를 안 보고
 * `getItem() || 'system'`으로 넘기면, `THEME_MODES` 밖의 문자열이 들어왔을 때 스크립트는
 * light로 확정하고 `readThemeMode()`는 `system`을 돌려줘 화면과 토글 표시가 갈린다.
 * 그 상태는 OS 설정을 바꾸기 전까지 스스로 복구되지 않는다.
 *
 * 보간은 전부 `JSON.stringify`다. 지금은 컴파일 타임 상수뿐이라 XSS 경로가 없지만,
 * 따옴표가 든 값으로 바뀌는 순간 스크립트가 깨지는 형태를 남기지 않는다.
 */
const THEME_SCRIPT = `(function () {
  var modes = ${JSON.stringify(THEME_MODES)}
  var mode = 'system'
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})
    if (modes.indexOf(stored) !== -1) mode = stored
  } catch (error) {
    mode = 'system'
  }
  var isDark =
    mode === 'dark' ||
    (mode === 'system' && matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)}).matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
})()`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
