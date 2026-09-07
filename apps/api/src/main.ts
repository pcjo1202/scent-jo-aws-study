import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { parseAllowedOrigins } from './cors-origins'

const DEFAULT_PORT = 3001

/**
 * `whitelist`가 DTO에 없는 속성을 **떨어뜨린다** — 본문의 `userId`가 서비스까지 갈 길이
 * 구조적으로 없어진다 (docs/05 「API 계약」). `forbidNonWhitelisted`로 400을 주지 않는
 * 이유는 오프라인 큐가 옛 화면이 만든 항목을 나중에 재전송하기 때문이다: 모르는 필드
 * 하나로 큐 전체가 rejected가 되면 기록이 사라진다.
 *
 * `transform`이 없으면 DTO가 평범한 객체로 남아 `@Type()`이 안 돌고, 중첩 배열
 * (`/attempts/batch`의 `items`)이 검증을 통째로 건너뛴다.
 */
export function createValidationPipe() {
  return new ValidationPipe({ whitelist: true, transform: true })
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: parseAllowedOrigins() })
  app.useGlobalPipes(createValidationPipe())
  await app.listen(process.env.PORT ?? DEFAULT_PORT)
}

void bootstrap()
