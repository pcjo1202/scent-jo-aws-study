import type { ChoiceKey } from '@aws-study/shared'
import type { ServiceAlias } from './service-aliases.ts'

/**
 * 문항 하나에 서비스·카테고리를 파생시킨다 (`04-data-model.md` 「자동 태깅」).
 *
 * **지문과 정답 선택지만 스캔한다.** 오답 선택지를 포함하면 "Redshift가 오답으로
 * 등장하는 Athena 문제"가 데이터베이스로 분류된다.
 */

/** `04` 「Question」의 `categories`는 1~3개다. */
const MAX_CATEGORIES = 3
/**
 * 최상위 점수의 1/N 미만인 카테고리는 버린다. 점수는 그 카테고리 서비스가 지문에
 * **몇 번 언급됐는지**다 — 배경으로 한 번 스치는 이름과 문제의 주제를 가른다.
 *
 * 없으면 컴퓨트가 1019문항의 50%를 먹는다 — SAA 지문은 대부분 EC2 위에서
 * 시나리오를 세우고, 그 배경 언급이 주제 태그로 올라오기 때문이다. 절반 컷으로
 * 컴퓨트가 416문항(40.8%)이 되고 문항당 카테고리가 1개 514 · 2개 346 · 3개 153 ·
 * 0개 6으로 갈린다 (`pnpm data:extract` 2026-08-28).
 */
const CATEGORY_SCORE_DIVISOR = 2
const WORD_CHARACTER = /[A-Za-z0-9]/

export type TaggableQuestion = {
  stem: string
  choices: Array<{ key: ChoiceKey; text: string }>
  answer: ChoiceKey[]
}

export type QuestionTopics = { services: string[]; categories: string[] }

/** `aliases`는 긴 것부터 정렬돼 있어야 한다 (`buildServiceAliases`가 보장한다). */
export function tagQuestion(question: TaggableQuestion, aliases: ServiceAlias[]): QuestionTopics {
  const text = toScanText(question).toLowerCase()
  const claimed = new Array<boolean>(text.length).fill(false)
  const services: string[] = []
  const scores = new Map<string, number>()

  for (const { alias, service, categories } of aliases) {
    const needle = alias.toLowerCase()
    let mentions = 0
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      if (!isFreeStanding(text, claimed, at, needle.length)) continue

      claimed.fill(true, at, at + needle.length)
      mentions += 1
    }
    if (mentions === 0) continue

    if (!services.includes(service)) services.push(service)
    for (const category of categories) {
      scores.set(category, (scores.get(category) ?? 0) + mentions)
    }
  }

  return { services, categories: rankCategories(scores) }
}

/** 지문 + 정답 선택지. 오답 선택지는 넣지 않는다. */
function toScanText(question: TaggableQuestion): string {
  const answer = new Set(question.answer)
  const correctChoices = question.choices.filter((choice) => answer.has(choice.key))

  return [question.stem, ...correctChoices.map((choice) => choice.text)].join('\n')
}

function rankCategories(scores: Map<string, number>): string[] {
  const ranked = [...scores].sort(([nameA, a], [nameB, b]) => b - a || nameA.localeCompare(nameB))
  const top = ranked[0]?.[1] ?? 0

  return ranked
    .filter(([, score]) => score * CATEGORY_SCORE_DIVISOR >= top)
    .slice(0, MAX_CATEGORIES)
    .map(([category]) => category)
}

/**
 * 이미 더 긴 별칭이 가져간 자리가 아니고, 영숫자에 붙어 있지 않은 매칭인가.
 *
 * 경계를 영숫자로만 보는 이유: 지문이 한글이라 `AWS Lambda를`처럼 이름 뒤에 조사가
 * 바로 붙는다. 공백을 요구하면 대부분을 놓친다.
 */
function isFreeStanding(text: string, claimed: boolean[], at: number, length: number): boolean {
  const before = text[at - 1]
  const after = text[at + length]
  if (before !== undefined && WORD_CHARACTER.test(before)) return false
  if (after !== undefined && WORD_CHARACTER.test(after)) return false

  return !claimed.slice(at, at + length).includes(true)
}
