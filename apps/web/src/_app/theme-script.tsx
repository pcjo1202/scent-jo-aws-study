import { colorModeScript } from '@scent-jo/css/color-mode'

/**
 * 첫 페인트 전에 `<html data-sj-color-mode>`를 확정한다. body 첫 자식의 동기 스크립트라 본문
 * 마크업이 파싱되기 전에 실행되고, 하이드레이션을 기다리지 않으므로 라이트 화면이 번쩍이지 않는다.
 * `<head>`에 두면 React가 "scripts inside React components are never executed when rendering
 * on the client"를 경고한다 — 렌더 블로킹 스타일시트 뒤라 실행 시점은 어차피 같다.
 */
const THEME_SCRIPT = colorModeScript()

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
