import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

import type { Provider } from '@nestjs/common'

export const DB = Symbol('DB')

export function createDb(connectionString: string) {
  // Drizzle 현행 문서가 Supabase 트랜잭션 풀러(:6543)에 지시하는 값이다.
  // 「없으면 터진다」는 실측에서 재현되지 않았다 — 왜 그래도 두는지는 docs/03 「데이터베이스 연결」
  return drizzle(postgres(connectionString, { prepare: false }), { schema })
}

export type Db = ReturnType<typeof createDb>

export const dbProvider: Provider = {
  provide: DB,
  useFactory: (config: ConfigService) => createDb(config.getOrThrow<string>('DATABASE_URL')),
  inject: [ConfigService],
}
