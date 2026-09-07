import { IsInt, Max, Min } from 'class-validator'

import { EXAM_QUESTION_COUNT } from '../../catalog/grading'

import type { UpdateExamRequest } from '@aws-study/shared'

/**
 * `exam_sessions_cursor` check와 같은 범위다. 근거는 `docs/05` 「PATCH /exams/:id」 —
 * **이걸 빼면 23514가 500으로 나간다.**
 *
 * `64`를 손으로 적지 않는 이유만 여기 남긴다: DB 상한은 `cardinality(question_ids) - 1`이라
 * 문항 수를 바꾸면 따라가는데 리터럴은 안 따라가고, 그때 400과 500의 경계가 조용히 움직인다.
 */
const MAX_CURSOR = EXAM_QUESTION_COUNT - 1

export class UpdateExamDto implements UpdateExamRequest {
  @IsInt()
  @Min(0)
  @Max(MAX_CURSOR)
  cursor!: number
}
