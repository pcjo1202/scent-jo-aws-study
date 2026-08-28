import { COLUMN_GAP, cleanNoteLines } from '../text/page-decoration.ts'
import type { OneLinerLines } from './parse-oneliner.ts'

/**
 * PC판 노트(파일 2)를 읽는다. **산출물의 원본이 아니다.**
 *
 * 두 가지로 쓴다.
 *
 * 1. **모바일 파싱의 대조 판본.** 파일 2와 3은 같은 내용을 다른 폭으로 렌더링한
 *    것이라(`01-requirements.md` 「원본 자료」) 줄을 접는 자리가 서로 다르다. 두
 *    판본을 합치면 줄 이음매의 공백을 추정하지 않고 복원할 수 있고, 읽어 낸 글자가
 *    다르면 그 자리에서 터진다 (`../text/merge-renderings.ts`).
 * 2. **비교노트 중요도(★)의 유일한 출처.** 모바일 판본에는 제목 뒤 `[★…]` 표기가
 *    없다. `02-features.md` 「비교노트」가 그 표기 유지를 요구하므로 여기서 읽는다.
 *
 * 표는 `서비스명 | 카테고리 | 한줄노트` 3열이고 열 경계가 2칸 이상 공백이다. 열
 * 폭이 페이지마다 달라 문자 위치로는 자를 수 없다 — 가운데 열이 카테고리인 것을
 * 신호로 삼는다. 카테고리 목록은 모바일 파싱 결과에서 받는다(하드코딩하지 않는다).
 */

const TABLE_HEADER = /서비스명\s{2,}카테고리/
/** 한줄노트 표가 끝나는 자리. 뒤는 비교노트다. */
const COMPARISON_SECTION = /^\s*Part 2/
/** 비교쌍 제목 줄. 제목 뒤 오른쪽 끝에 중요도가 붙는다. */
const COMPARISON_TITLE = /^\s*(\S.*?)\s{2,}\[(★+)\]\s*$/

export function parseDesktopOneLiners(
  rawText: string,
  categories: ReadonlySet<string>,
): OneLinerLines[] {
  const cards: OneLinerLines[] = []
  let open: OneLinerLines | undefined

  for (const line of cleanNoteLines(rawText)) {
    if (COMPARISON_SECTION.test(line)) break
    if (!line.trim() || TABLE_HEADER.test(line)) continue
    // 카테고리 런이 바뀌는 자리의 섹션 제목. 지우지 않으면 직전 행의 노트 끝에 붙는다.
    if (categories.has(line.trim())) continue

    const parts = line.trim().split(COLUMN_GAP)
    if (!line.startsWith(' ') && parts.length >= 3 && categories.has(parts[1]!)) {
      open = { service: [parts[0]!], category: parts[1]!, note: [parts.slice(2).join(' ')] }
      cards.push(open)
      continue
    }

    if (!open) continue
    // 들여쓰기 없이 이어지는 줄의 첫 조각은 서비스명이 접힌 것이다.
    if (line.startsWith(' ')) open.note.push(parts.join(' '))
    else {
      open.service.push(parts[0]!)
      open.note.push(parts.slice(1).join(' '))
    }
  }

  return cards
}

/** 비교쌍 제목 → 원본 ★ 개수. */
export function parseImportanceByTitle(rawText: string): Map<string, number> {
  const importance = new Map<string, number>()

  for (const line of cleanNoteLines(rawText)) {
    const title = COMPARISON_TITLE.exec(line)
    if (title) importance.set(title[1]!.trim(), title[2]!.length)
  }

  return importance
}
