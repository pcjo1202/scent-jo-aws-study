import type { Server } from 'node:http'

import { Controller, Get, Module, Param, Post } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { AppController } from '../app.controller'
import { AuthModule } from './auth.module'
import { JwksService } from './jwks.service'
import { Public } from './public.decorator'

/**
 * 9케이스 통과는 "가드가 돈다"는 증거이지 "빠짐없이 막는다"는 증거가 아니다.
 * `@Public()`을 안 붙인 라우트가 뚫릴 수 있는 경로를 한 파일에 모아 세고,
 * 통과해야 할 것까지 같이 넣어 오탐도 본다 (CLAUDE.md 「강제 장치는 우회 경로로 평가한다」).
 *
 * 여기서 세는 것은 이 파일이 만든 라우트다. 남은 구멍은 **누군가 실제 컨트롤러에
 * `@Public()`을 잘못 붙이는 것**이고, 그건 AppModule의 라우트를 열거해 `IS_PUBLIC_KEY`가
 * `/health` 하나에만 붙었는지 단언해야 잡힌다. 지금 라우트가 `/health` 하나뿐이라
 * 값이 작아 미룬다 — 도메인 라우트가 생기는 SJO-13 이후에 넣는다.
 */
@Controller('unmarked')
class UnmarkedController {
  @Get()
  read() {
    return { reached: true }
  }

  @Post()
  create() {
    return { reached: true }
  }

  @Get(':id')
  readOne(@Param('id') id: string) {
    return { reached: id }
  }
}

@Controller('mixed')
class MixedController {
  @Public()
  @Get('open')
  readOpen() {
    return { reached: true }
  }

  @Get('closed')
  readClosed() {
    return { reached: true }
  }
}

@Public()
@Controller('open-all')
class OpenAllController {
  @Get()
  read() {
    return { reached: true }
  }
}

@Controller('separate')
class SeparateController {
  @Get()
  read() {
    return { reached: true }
  }
}

@Module({ controllers: [SeparateController] })
class SeparateModule {}

const BLOCKED_ROUTES = [
  { name: '@Public() 없는 GET', method: 'get', path: '/unmarked' },
  { name: '@Public() 없는 POST', method: 'post', path: '/unmarked' },
  { name: '경로 파라미터 라우트', method: 'get', path: '/unmarked/42' },
  { name: '@Public() 메서드의 형제 메서드', method: 'get', path: '/mixed/closed' },
  { name: '다른 모듈에 등록된 컨트롤러', method: 'get', path: '/separate' },
] as const

const ALLOWED_ROUTES = [
  { name: '@Public() 메서드', method: 'get', path: '/mixed/open' },
  { name: '컨트롤러 전체에 @Public()', method: 'get', path: '/open-all' },
  { name: '/health', method: 'get', path: '/health' },
] as const

let app: INestApplication

// supertest는 요청마다 서버를 띄우므로 동시에 보내지 않는다 — 병렬로 보내면 ECONNRESET이 난다
async function collectStatuses(routes: readonly { name: string; method: string; path: string }[]) {
  const statuses: Record<string, number> = {}

  for (const route of routes) {
    // getHttpServer()의 반환 타입이 any다. Express 어댑터가 주는 것은 http.Server다
    const call = request(app.getHttpServer() as Server)
    const response = await (route.method === 'post' ? call.post(route.path) : call.get(route.path))

    statuses[route.name] = response.status
  }

  return statuses
}

function expectedStatuses(routes: readonly { name: string }[], status: number) {
  return Object.fromEntries(routes.map((route) => [route.name, status]))
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            SUPABASE_JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
            ALLOWED_EMAIL: 'owner@example.com',
          }),
        ],
      }),
      AuthModule,
      SeparateModule,
    ],
    controllers: [AppController, UnmarkedController, MixedController, OpenAllController],
  })
    .overrideProvider(JwksService)
    // 이 파일은 토큰을 보내지 않는다. 여기까지 오면 가드가 토큰 없이 검증을 시도한 것이다
    .useValue({
      resolveKey: () => {
        throw new Error('토큰 없는 요청이 키 조회까지 도달했다')
      },
    })
    .compile()

  app = moduleRef.createNestApplication()
  await app.init()
})

afterAll(async () => {
  await app.close()
})

it(`차단 대상 ${BLOCKED_ROUTES.length}개를 ${BLOCKED_ROUTES.length}개 다 막는다`, async () => {
  expect(await collectStatuses(BLOCKED_ROUTES)).toEqual(expectedStatuses(BLOCKED_ROUTES, 401))
})

it(`통과 대상 ${ALLOWED_ROUTES.length}개를 ${ALLOWED_ROUTES.length}개 다 통과시킨다`, async () => {
  expect(await collectStatuses(ALLOWED_ROUTES)).toEqual(expectedStatuses(ALLOWED_ROUTES, 200))
})
