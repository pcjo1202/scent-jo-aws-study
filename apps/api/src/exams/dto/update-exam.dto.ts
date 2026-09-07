import { IsInt, Max, Min } from 'class-validator'

import { EXAM_QUESTION_COUNT } from '../../catalog/grading'

import type { UpdateExamRequest } from '@aws-study/shared'

/**
 * `exam_sessions_cursor` check와 같은 범위다 — `0`~`64` (`docs/05` 「exam_sessions」).
 *
 * **여기서 거르지 않으면 500이 나간다.** DB check만 두면 `cursor: 65`가 Postgres 23514로
 * 죽고, 그건 `HttpException`이 아니라 500이 된다 — 클라이언트가 자기 잘못을 서버 장애로
 * 읽는다. DB 제약은 무결성을 지키고 DTO는 400과 500의 경계다 (`apps/api/CLAUDE.md`
 * 「마이그레이션」).
 *
 * 상한을 `64`로 적지 않고 `EXAM_QUESTION_COUNT`에서 빼는 이유는 문항 수가 바뀌면 DB의
 * `cardinality(question_ids) - 1`은 따라가는데 손으로 적은 64는 안 따라가기 때문이다 —
 * 그때 400과 500의 경계가 조용히 움직인다.
 */
const MAX_CURSOR = EXAM_QUESTION_COUNT - 1

export class UpdateExamDto implements UpdateExamRequest {
  @IsInt()
  @Min(0)
  @Max(MAX_CURSOR)
  cursor!: number
}
