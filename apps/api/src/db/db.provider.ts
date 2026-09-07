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

/**
 * `db.transaction`이 콜백에 주는 핸들. 쿼리 함수가 `Db`와 `Tx`를 **둘 다** 받아야
 * 같은 문장을 트랜잭션 안팎에서 쓸 수 있다 — 두 벌로 나누면 한쪽만 고쳐진다.
 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type DbOrTx = Db | Tx

export const dbProvider: Provider = {
  provide: DB,
  useFactory: (config: ConfigService) => createDb(config.getOrThrow<string>('DATABASE_URL')),
  inject: [ConfigService],
}
