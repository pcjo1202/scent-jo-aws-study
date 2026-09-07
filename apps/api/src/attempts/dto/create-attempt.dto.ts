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
  durationMs?: number

  @IsOptional()
  @IsBoolean()
  advancesPointer?: boolean
}

export class BatchAttemptItemDto extends CreateAttemptDto implements BatchAttemptItem {
  @IsISO8601()
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
