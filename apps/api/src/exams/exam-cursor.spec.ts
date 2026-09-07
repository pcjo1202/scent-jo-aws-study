import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { EXAM_QUESTION_COUNT } from '../catalog/grading'
import { UpdateExamDto } from './dto/update-exam.dto'

/**
 * `cursor` 범위 검증은 **400과 500의 경계**다 (SJO-30 E3, SJO-13 리뷰에서 나옴).
 *
 * DB의 `exam_sessions_cursor` check가 같은 범위를 강제하지만 그건 Postgres 23514를
 * 던지고, 그건 `HttpException`이 아니라 500이 된다. DTO가 없으면 클라이언트가 자기
 * 잘못을 서버 장애로 읽는다.
 *
 * `main.ts`의 전역 `ValidationPipe`를 여기서 띄우지 않고 DTO를 직접 친다 — 그 파일은
 * import 시점에 앱을 띄운다 (`attempts-batch.spec.ts`와 같은 이유).
 */
function violations(value: unknown) {
  return validateSync(plainToInstance(UpdateExamDto, value)).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  )
}

describe('PATCH /exams/:id — cursor DTO', () => {
  it('0과 64는 통과한다', () => {
    expect(violations({ cursor: 0 })).toEqual([])
    expect(violations({ cursor: EXAM_QUESTION_COUNT - 1 })).toEqual([])
  })

  /** 마지막 문항에서 「다음」이 「종료」로 바뀌므로 65번째 위치가 없다 (`docs/05`). */
  it('65는 400이다 — DB check(23514)에 닿지 않는다', () => {
    expect(violations({ cursor: EXAM_QUESTION_COUNT })).toContain('max')
  })

  it('음수는 400이다', () => {
    expect(violations({ cursor: -1 })).toContain('min')
  })

  it('정수가 아니면 400이다', () => {
    expect(violations({ cursor: 1.5 })).toContain('isInt')
    expect(violations({ cursor: '3' })).toContain('isInt')
    expect(violations({ cursor: null })).toContain('isInt')
  })

  it('cursor가 없으면 400이다', () => {
    expect(violations({})).toContain('isInt')
  })

  /**
   * 상한을 손으로 `64`라 적으면 문항 수가 바뀌었을 때 DB의
   * `cardinality(question_ids) - 1`만 따라가고 DTO는 안 따라간다 — 그때 400과 500의
   * 경계가 조용히 움직인다. 상수에서 파생됐는지를 여기서 못박는다.
   */
  it('상한이 EXAM_QUESTION_COUNT에서 파생된다', () => {
    expect(violations({ cursor: EXAM_QUESTION_COUNT - 1 })).toEqual([])
    expect(violations({ cursor: EXAM_QUESTION_COUNT })).toContain('max')
  })
})
