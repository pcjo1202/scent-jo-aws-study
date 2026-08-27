import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

const DEFAULT_PORT = 3001
const DEFAULT_CORS_ORIGINS = 'http://localhost:3000'

function parseAllowedOrigins() {
  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  // 빈 항목을 남기면 cors가 완전 일치로만 판정해 모든 Origin이 조용히 차단된다.
  // 로그 없이 죽는 대신 부팅에서 멈춘다 (docs/06 「검증」).
  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS가 비어 있다. 허용할 Origin을 최소 하나 지정한다.')
  }

  return origins
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: parseAllowedOrigins() })
  await app.listen(process.env.PORT ?? DEFAULT_PORT)
}

void bootstrap()
