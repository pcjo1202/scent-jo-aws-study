'use client'

import { useEffect, useState } from 'react'

import {
  applyThemeMode,
  DARK_SCHEME_QUERY,
  readThemeMode,
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
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')

  // 저장값은 서버에 없다. 마운트 후에 읽어야 하이드레이션이 어긋나지 않는다.
  // 화면의 테마 자체는 이 시점 이전에 인라인 스크립트가 이미 적용해 뒀다.
  useEffect(() => {
    setMode(readThemeMode())
  }, [])

  // `system`일 때만 OS 설정 변경을 따라간다. 명시적으로 고른 값은 OS가 바뀌어도 유지된다.
  useEffect(() => {
    if (mode !== 'system') return

    const query = window.matchMedia(DARK_SCHEME_QUERY)
    const handleSchemeChange = () => applyThemeMode('system')

    query.addEventListener('change', handleSchemeChange)
    return () => query.removeEventListener('change', handleSchemeChange)
  }, [mode])

  function handleModeChange(next: ThemeMode) {
    setMode(next)
    applyThemeMode(next)
  }

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
            onChange={() => handleModeChange(value)}
            className="accent-primary"
          />
          {MODE_LABEL[value]}
        </label>
      ))}
    </fieldset>
  )
}
