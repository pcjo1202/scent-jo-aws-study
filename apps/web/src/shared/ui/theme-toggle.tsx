'use client'

import { SegmentedControl } from '@scent-jo/react'
import { useId, useSyncExternalStore } from 'react'

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
 * 3상태 테마 선택 (`DESIGN.md` 「대시보드 요소」 테마 설정). DS `SegmentedControl`이다 — 안이
 * 네이티브 라디오라 키보드 이동과 포커스 링을 그대로 얻는다. **아이콘을 쓰지 않는다** — 세
 * 상태를 글자로 쓰면 지금 무엇인지가 한눈에 보인다.
 *
 * 선택값을 컴포넌트 상태로 들지 않는다. `<html data-sj-color-mode>`가 SSOT이고,
 * 복사본을 두면 화면과 그 속성이 갈라질 수 있다.
 *
 * 천장: localStorage가 막힌 브라우저(사파리 프라이빗)에서는 선택이 새로고침에 유지되지 않는다.
 * 다른 탭의 변경도 반영하지 않는다 — 개인용 v1이라 미룬다.
 */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeThemeMode, readThemeMode, readServerThemeMode)
  const labelId = useId()

  return (
    <div className="flex items-center gap-4">
      <span id={labelId} className="text-t6 text-secondary">
        테마
      </span>
      <SegmentedControl
        aria-labelledby={labelId}
        value={mode}
        onChange={(value) => {
          const next = THEME_MODES.find((candidate) => candidate === value)
          if (next) applyThemeMode(next)
        }}
        className="flex-1"
      >
        {THEME_MODES.map((value) => (
          <SegmentedControl.Item key={value} value={value}>
            {MODE_LABEL[value]}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </div>
  )
}
