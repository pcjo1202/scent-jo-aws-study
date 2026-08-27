import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

const DEFAULT_PORT = 3001
const DEFAULT_CORS_ORIGINS = 'http://localhost:3000'

function parseAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? DEFAULT_CORS_ORIGINS
  return raw.split(',').map((origin) => origin.trim())
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: parseAllowedOrigins() })
  await app.listen(process.env.PORT ?? DEFAULT_PORT)
}

void bootstrap()
