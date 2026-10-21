'use client'

import { useSyncExternalStore } from 'react'

import {
  applyThemeMode,
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
 * 선택값을 컴포넌트 상태로 들지 않는다. `<html data-sj-color-mode>`가 SSOT이고,
 * 복사본을 두면 화면과 그 속성이 갈라질 수 있다.
 *
 * 천장: localStorage가 막힌 브라우저(사파리 프라이빗)에서는 선택이 새로고침에 유지되지 않는다.
 * 다른 탭의 변경도 반영하지 않는다 — 개인용 v1이라 미룬다.
 */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeThemeMode, readThemeMode, readServerThemeMode)

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
