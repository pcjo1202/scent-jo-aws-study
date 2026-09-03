import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

import type { Provider } from '@nestjs/common'

export const DB = Symbol('DB')

export function createDb(connectionString: string) {
  // prepare: false가 빠지면 런타임에 터진다 — Supavisor 트랜잭션 풀러(:6543)는 요청마다
  // 다른 백엔드를 주므로 prepared statement가 재사용되지 않는다 (docs/03 「데이터베이스 연결」)
  return drizzle(postgres(connectionString, { prepare: false }), { schema })
}

export type Db = ReturnType<typeof createDb>

export const dbProvider: Provider = {
  provide: DB,
  useFactory: (config: ConfigService) => createDb(config.getOrThrow<string>('DATABASE_URL')),
  inject: [ConfigService],
}
