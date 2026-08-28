import { cleanNoteLines } from '../text/page-decoration.ts'

/**
 * 모바일 노트 PDF(파일 3)의 `pdftotext -layout` 출력을 빈 줄 단위 그룹으로 자른다.
 *
 * 카드 레이아웃이라 카드 사이가 빈 줄로 벌어져 있고, 카드 안에서는 줄이 붙어
 * 나온다. 그래서 빈 줄이 곧 카드 경계다 — 절 제목 같은 본문 신호를 쓰지 않아도
 * 된다.
 *
 * 페이지 장식은 여기서 전부 걷어낸다. `\f`는 **다음 페이지 첫 줄 앞에** 붙어
 * 나오므로 지우지 않으면 페이지 첫 줄이 `^카테고리` 같은 패턴에 걸리지 않는다
 * (`LESSONS.md` 2026-08-28 「정제 전 텍스트로 집계해…」).
 */

/** 절 표지. 원본이 두 절을 각각 표지 한 장으로 연다. */
const ONELINER_COVER = /^\s*한줄노트\s*$/
const COMPARISON_COVER = /^\s*비교노트\s*$/

export type NoteSections = {
  /** 한줄노트 절. 각 그룹은 카테고리 줄 하나이거나 `[서비스명, ...노트 줄]`이다. */
  oneliner: string[][]
  /** 비교노트 절. 제목·구성원명·2열 본문·결정적 차이가 각각 한 그룹이다. */
  comparison: string[][]
}

export function splitNoteSections(rawText: string): NoteSections {
  const groups = groupByBlankLines(cleanNoteLines(rawText))

  const onelinerCover = groups.findIndex((group) => group.some(matches(ONELINER_COVER)))
  const comparisonCover = groups.findIndex((group) => group.some(matches(COMPARISON_COVER)))
  if (onelinerCover < 0 || comparisonCover < 0) {
    throw new Error(
      `노트 절 표지를 찾지 못했다: 한줄노트 ${onelinerCover} · 비교노트 ${comparisonCover}`,
    )
  }
  if (onelinerCover > comparisonCover) {
    throw new Error('비교노트 표지가 한줄노트 표지보다 앞에 있다 — 원본 구성이 바뀌었다')
  }

  return {
    oneliner: groups.slice(onelinerCover + 1, comparisonCover),
    comparison: groups.slice(comparisonCover + 1),
  }
}

function groupByBlankLines(lines: string[]) {
  const groups: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.trim()) {
      current.push(line)
      continue
    }
    if (current.length > 0) {
      groups.push(current)
      current = []
    }
  }
  if (current.length > 0) groups.push(current)

  return groups
}

function matches(pattern: RegExp) {
  return (line: string) => pattern.test(line)
}
