import { joinWrappedLines } from '../text/join-wrapped-lines.ts'
import type { SeamOracle } from '../text/seam-oracle.ts'

/**
 * 모바일 노트의 비교노트를 읽는다 (`04-data-model.md` 「comparisons.json」).
 *
 * 구성원 하나가 `구성원명` → `선택 신호 / 탈락 신호` 표 → `★ 결정적 차이` 순으로
 * 나오고, 비교쌍 제목은 첫 구성원 앞에 한 번 온다. 카드가 페이지를 넘기면 제목이
 * `… (계속)`으로 다시 나오므로 같은 제목으로 이어 붙인다.
 *
 * **빈 줄 그룹을 경계로 쓰지 않는다.** 결정적 차이가 두 줄로 접히면 그 줄이 다음
 * 그룹에 붙어 나와 경계가 어긋난다. 대신 `선택 신호/탈락 신호` 머리글을 앵커로
 * 삼는다 — **그 바로 앞 줄이 언제나 구성원명이다.** 그 사이에 남는 줄은 들여쓰기로
 * 가른다: 왼쪽 끝에서 시작하면 새 비교쌍 제목, 들여쓰여 있으면 앞 구성원의 결정적
 * 차이가 접힌 줄이다.
 *
 * 열 경계도 문자 위치로 자를 수 없다 — 한글이 두 칸을 차지해 `pdftotext`의 여백과
 * 문자열 인덱스가 어긋난다. 2칸 이상 공백을 경계로 쓰고, 한쪽 열만 이어지는 줄은
 * 들여쓰기로 어느 열인지 정한다.
 */

/** 구성원 표의 머리글. 이 줄이 구성원 하나의 시작점이다. */
const SIGNAL_HEADER = /^\s*선택 신호\s{2,}탈락 신호\s*$/
const KEY_DIFFERENCE = /^\s*★ 결정적 차이\s{2,}(\S.*)$/
/** 페이지를 넘긴 카드의 제목에 붙는 꼬리. */
const CONTINUED = /\s*\(계속\)$/
const COLUMN_GAP = / {2,}/

export type ComparisonMember = {
  name: string
  selectSignals: string
  rejectSignals: string
  keyDifference: string
}

export type Comparison = {
  title: string
  /** 원본 ★ 개수. 모바일 판본에 없어 PC판에서 받는다 (`desktop-notes.ts`). */
  importance: number
  members: ComparisonMember[]
}

type OpenMember = { name: string; select: string[]; reject: string[]; key: string[] }
type OpenComparison = { title: string; members: OpenMember[] }

export function parseComparisons(
  groups: string[][],
  importanceByTitle: ReadonlyMap<string, number>,
  seamHasSpace?: SeamOracle,
): Comparison[] {
  const open = new Map<string, OpenComparison>()
  let comparison: OpenComparison | undefined
  let member: OpenMember | undefined
  let pending: string[] = []
  let isBody = false

  for (const line of groups.flat()) {
    if (SIGNAL_HEADER.test(line)) {
      const name = pending.pop()
      if (name === undefined) throw new Error('구성원명 없이 신호 표가 시작됐다')

      for (const extra of pending) {
        if (!extra.startsWith(' ')) {
          comparison = openComparison(open, extra)
          continue
        }
        if (!member) throw new Error(`제목도 구성원도 아닌 줄: ${extra.trim()}`)
        member.key.push(extra)
      }
      if (!comparison) throw new Error(`제목 없이 시작하는 구성원: ${name.trim()}`)

      member = { name: name.trim(), select: [], reject: [], key: [] }
      comparison.members.push(member)
      pending = []
      isBody = true
      continue
    }

    const keyDifference = KEY_DIFFERENCE.exec(line)
    if (keyDifference && member) {
      member.key.push(keyDifference[1]!)
      isBody = false
      continue
    }

    if (isBody && member) {
      pushSignalRow(member, line)
      continue
    }
    pending.push(line)
  }

  return [...open.values()].map((entry) => toComparison(entry, importanceByTitle, seamHasSpace))
}

function openComparison(open: Map<string, OpenComparison>, line: string) {
  const title = line.trim().replace(CONTINUED, '')
  const existing = open.get(title)
  if (existing) return existing

  const created = { title, members: [] }
  open.set(title, created)
  return created
}

function pushSignalRow(member: OpenMember, line: string) {
  const parts = line.trim().split(COLUMN_GAP)
  if (parts.length > 2) throw new Error(`신호 표의 열이 셋 이상이다: ${line.trim()}`)

  // 한쪽 열만 이어지는 줄. 왼쪽 열은 들여쓰기 없이 시작한다.
  if (parts.length === 1) {
    if (line.startsWith(' ')) member.reject.push(parts[0]!)
    else member.select.push(parts[0]!)
    return
  }

  member.select.push(parts[0]!)
  member.reject.push(parts[1]!)
}

function toComparison(
  entry: OpenComparison,
  importanceByTitle: ReadonlyMap<string, number>,
  seamHasSpace?: SeamOracle,
): Comparison {
  const importance = importanceByTitle.get(entry.title)
  if (importance === undefined) {
    throw new Error(`PC판에 중요도 표기가 없는 비교쌍: ${entry.title}`)
  }

  return {
    title: entry.title,
    importance,
    members: entry.members.map((member) => ({
      name: member.name,
      selectSignals: joinWrappedLines(member.select, seamHasSpace),
      rejectSignals: joinWrappedLines(member.reject, seamHasSpace),
      keyDifference: joinWrappedLines(member.key, seamHasSpace),
    })),
  }
}
