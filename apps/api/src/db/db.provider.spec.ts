import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

const { postgresMock } = vi.hoisted(() => ({ postgresMock: vi.fn(() => ({})) }))

vi.mock('postgres', () => ({ default: postgresMock }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({})) }))

import { DbModule } from './db.module'
import { createDb, DB } from './db.provider'

const CONNECTION_STRING = 'postgresql://user:pw@pooler.example.com:6543/postgres'
// 모듈 배선이 정말 이 값을 읽었는지 가르려면 위와 다른 문자열이어야 한다
const MODULE_CONNECTION_STRING = 'postgresql://module:pw@pooler.example.com:6543/postgres'

const CONSUMER = Symbol('CONSUMER')

/**
 * DbModule을 import하지 않는다. `@Global`과 `exports: [DB]`가 살아 있어야만 해석된다 —
 * 도메인 모듈(attempts·exams·progress·stats)이 놓일 자리를 그대로 흉내낸다.
 */
@Module({
  providers: [{ provide: CONSUMER, useFactory: (db: unknown) => db, inject: [DB] }],
})
class ConsumerModule {}

describe('createDb', () => {
  it('드라이버에 prepare: false를 넘긴다', () => {
    createDb(CONNECTION_STRING)

    expect(postgresMock).toHaveBeenCalledWith(CONNECTION_STRING, { prepare: false })
  })
})

describe('DbModule', () => {
  // 배선(@Global · exports · inject)은 createDb를 직접 부르는 테스트가 지나지 않는 경로다.
  // 실제 부팅으로도 확인할 수 없다 — 배포된 api가 SJO-49로 죽어 있다
  it('DbModule을 import하지 않은 모듈이 DB를 주입받는다', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_URL: MODULE_CONNECTION_STRING })],
        }),
        DbModule,
        ConsumerModule,
      ],
    }).compile()

    expect(moduleRef.get(CONSUMER)).toBeDefined()
    expect(postgresMock).toHaveBeenCalledWith(MODULE_CONNECTION_STRING, { prepare: false })

    await moduleRef.close()
  })
})
