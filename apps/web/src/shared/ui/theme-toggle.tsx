'use client'

import { useEffect, useSyncExternalStore } from 'react'

import {
  applyThemeMode,
  DARK_SCHEME_QUERY,
  readServerThemeMode,
  readThemeMode,
  subscribeThemeMode,
  THEME_MODES,
  type ThemeMode,
} from '@/shared/lib/theme'

const MODE_LABEL: Record<ThemeMode, string> = {
  system: '시스템',
  light: '라이트',
  dark: '다크',
}

/**
 * 3상태 테마 선택. 시각 형태는 잠정이다 — 화면상 위치와 최종 표현은 대시보드(SJO-27)에서
 * 정한다 (SJO-30 「테마 토글의 화면상 위치」). 네이티브 라디오를 쓰는 이유는 키보드 이동과
 * 포커스 링을 공짜로 얻기 위해서다.
 *
 * 선택값을 컴포넌트 상태로 들지 않는다. 저장소가 localStorage라 그쪽이 SSOT이고,
 * 복사본을 두면 화면과 `data-theme`이 갈라질 수 있다.
 *
 * 천장: localStorage가 막힌 브라우저(사파리 프라이빗)에서는 저장이 던져 라디오가 "시스템"으로
 * 되돌아간 채 화면만 바뀐다. 저장소를 SSOT로 둔 대가이고, 그 환경에서 테마는 어차피
 * 새로고침에 유지되지 않는다. 다른 탭의 변경도 반영하지 않는다 — 개인용 v1이라 미룬다.
 */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeThemeMode, readThemeMode, readServerThemeMode)

  // `system`일 때만 OS 설정 변경을 따라간다. 명시적으로 고른 값은 OS가 바뀌어도 유지된다.
  useEffect(() => {
    if (mode !== 'system') return

    const query = window.matchMedia(DARK_SCHEME_QUERY)
    const handleSchemeChange = () => applyThemeMode('system')

    query.addEventListener('change', handleSchemeChange)
    return () => query.removeEventListener('change', handleSchemeChange)
  }, [mode])

  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend className="text-label-medium text-on-surface-variant">테마</legend>
      {THEME_MODES.map((value) => (
        <label key={value} className="flex min-h-12 min-w-12 items-center gap-2 text-label-large">
          <input
            type="radio"
            name="theme"
            value={value}
            checked={mode === value}
            onChange={() => applyThemeMode(value)}
            className="accent-primary"
          />
          {MODE_LABEL[value]}
        </label>
      ))}
    </fieldset>
  )
}
