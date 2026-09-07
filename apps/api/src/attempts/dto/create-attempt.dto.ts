import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

import type {
  AttemptSource,
  BatchAttemptItem,
  ChoiceKey,
  CreateAttemptBatchRequest,
  CreateAttemptRequest,
} from '@aws-study/shared'

const ATTEMPT_SOURCES: AttemptSource[] = ['sequential', 'review', 'exam']

/** `attempts_selected_size` check와 같은 값이다 — 정답이 최대 3개다 (`docs/05` 「attempts」). */
const MAX_SELECTED_CHOICES = 3

/**
 * `duration_ms`가 `integer` 컬럼이라 이 값을 넘기면 Postgres가 22003으로 죽는다. 그건
 * `HttpException`이 아니라 배치에서 `rejected`로 격리되지 않고 **응답 전체를 날린다** —
 * 앞 항목은 이미 저장됐는데 클라이언트는 `results`를 못 받는다. 화면이 경과시간 대신
 * `Date.now()`를 넣는 종류의 버그면 24.8일치를 넘겨 바로 재현된다.
 */
const MAX_DURATION_MS = 2_147_483_647

/**
 * `questionId`의 상한을 여기 적지 않는다. 실재 여부는 `catalog` 인덱스가 아는 것이고,
 * 1019를 DTO에 다시 적으면 데이터가 늘었을 때 갈라진다 — 없는 문항은 서비스가 400을 준다.
 * 선택지 키도 같다: `choiceCount`가 문항마다 다르므로 여기서는 문자열까지만 본다.
 */
export class CreateAttemptDto implements CreateAttemptRequest {
  @IsInt()
  @Min(1)
  questionId!: number

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SELECTED_CHOICES)
  @IsString({ each: true })
  selected!: ChoiceKey[]

  @IsIn(ATTEMPT_SOURCES)
  source!: AttemptSource

  @IsOptional()
  @IsUUID()
  sessionId?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_DURATION_MS)
  durationMs?: number

  @IsOptional()
  @IsBoolean()
  advancesPointer?: boolean
}

export class BatchAttemptItemDto extends CreateAttemptDto implements BatchAttemptItem {
  /**
   * `strict`가 없으면 `'2026-02-31'`이 통과해 3월 3일로 조용히 밀린다 (실측).
   *
   * 날짜만 있는 `'2026-09-01'`은 여전히 통과한다 — ISO 8601로 유효하고, 그래서 생기는
   * 「여러 행이 같은 자정으로 뭉친다」는 도출 쿼리의 `id` 타이브레이크가 받는다
   * (`progress.repository.ts`).
   */
  @IsISO8601({ strict: true })
  answeredAt!: string
}

/**
 * `@ValidateNested`는 `items`가 실제 DTO 인스턴스일 때만 돈다 — `@Type()`과 전역
 * `ValidationPipe`의 `transform: true`가 그것을 만든다 (`main.ts`).
 */
export class CreateAttemptBatchDto implements CreateAttemptBatchRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchAttemptItemDto)
  items!: BatchAttemptItemDto[]
}
