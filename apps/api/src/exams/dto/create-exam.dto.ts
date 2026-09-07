import { IsBoolean, IsOptional } from 'class-validator'

import type { CreateExamRequest } from '@aws-study/shared'

/**
 * 본문이 없어도 된다 — 기본은 균등 무작위다 (`docs/05` 「POST /exams」).
 *
 * `preferUnsolved`의 기본을 false로 둔 이유는 `02-features.md` 「세션 생성」이 균등
 * 무작위를 기준으로 쓰고 「안 푼 문항 우선」을 그 위의 옵션으로 적었기 때문이다.
 */
export class CreateExamDto implements CreateExamRequest {
  @IsOptional()
  @IsBoolean()
  preferUnsolved?: boolean
}
