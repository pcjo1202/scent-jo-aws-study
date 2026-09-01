import type { Server } from 'node:http'

import { Controller, Get } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import type { JWK, KeyLike } from 'jose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppController } from '../app.controller'
import { AuthModule } from './auth.module'
import { CurrentUser } from './current-user.decorator'
import { JwksService } from './jwks.service'
import type { AuthUser } from './supabase-jwt.guard'

const ISSUER = 'https://ref.supabase.co/auth/v1'
const ALLOWED_EMAIL = 'owner@example.com'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const KID = 'signing-key'

/** 실제 Supabase 서명이 ES256(EC P-256)이다. RSA 키쌍으로는 같은 경로를 타지 않는다 (docs/07 §1). */
const SIGNING_ALGORITHM = 'ES256'

@Controller('probe')
class ProbeController {
  @Get()
  read(@CurrentUser() user: AuthUser) {
    return { userId: user.id }
  }
}

let app: INestApplication
let signingKey: KeyLike
let forgedKey: KeyLike

interface TokenOptions {
  issuer?: string
  audience?: string
  email?: string
  kid?: string
  key?: KeyLike
  expirationTime?: string
}

async function signToken(options: TokenOptions = {}) {
  const {
    issuer = ISSUER,
    audience = 'authenticated',
    email = ALLOWED_EMAIL,
    kid = KID,
    key = signingKey,
    expirationTime = '1h',
  } = options

  return new SignJWT({ email })
    .setProtectedHeader({ alg: SIGNING_ALGORITHM, kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(USER_ID)
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(key)
}

// getHttpServer()의 반환 타입이 any다. Express 어댑터가 주는 것은 http.Server다
function httpServer() {
  return app.getHttpServer() as Server
}

function callProbe(token?: string) {
  const call = request(httpServer()).get('/probe')

  return token === undefined ? call : call.set('Authorization', `Bearer ${token}`)
}

beforeAll(async () => {
  const signingPair = await generateKeyPair(SIGNING_ALGORITHM, { extractable: true })
  const forgedPair = await generateKeyPair(SIGNING_ALGORITHM, { extractable: true })

  signingKey = signingPair.privateKey
  forgedKey = forgedPair.privateKey

  const publicJwk: JWK = await exportJWK(signingPair.publicKey)
  // JWKS는 스텁이다. 테스트가 실제 Supabase를 부르지 않는다 (docs/08 §3)
  const resolveKey = createLocalJWKSet({
    keys: [{ ...publicJwk, alg: SIGNING_ALGORITHM, use: 'sig', kid: KID }],
  })

  // AuthModule을 그대로 쓴다 — 전역 가드 등록 자체가 검증 대상이다
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ SUPABASE_JWT_ISSUER: ISSUER, ALLOWED_EMAIL })],
      }),
      AuthModule,
    ],
    controllers: [AppController, ProbeController],
  })
    .overrideProvider(JwksService)
    .useValue({ resolveKey })
    .compile()

  app = moduleRef.createNestApplication()
  await app.init()
})

afterAll(async () => {
  await app.close()
})

describe('SupabaseJwtGuard — docs/08 §3 9케이스', () => {
  it('유효한 토큰은 통과하고 sub가 user_id로 들어온다', async () => {
    const response = await callProbe(await signToken()).expect(200)

    expect(response.body).toEqual({ userId: USER_ID })
  })

  it('토큰이 없으면 401', async () => {
    await callProbe().expect(401)
  })

  it('만료된 토큰은 401', async () => {
    await callProbe(await signToken({ expirationTime: '-1h' })).expect(401)
  })

  it('서명이 맞지 않으면 401', async () => {
    await callProbe(await signToken({ key: forgedKey })).expect(401)
  })

  it('알 수 없는 kid는 401', async () => {
    await callProbe(await signToken({ kid: 'rotated-away' })).expect(401)
  })

  it('iss가 다르면 401', async () => {
    await callProbe(await signToken({ issuer: 'https://evil.supabase.co/auth/v1' })).expect(401)
  })

  it('aud가 authenticated가 아니면 401', async () => {
    await callProbe(await signToken({ audience: 'anon' })).expect(401)
  })

  it('email이 ALLOWED_EMAIL과 다르면 403', async () => {
    await callProbe(await signToken({ email: 'someone-else@example.com' })).expect(403)
  })

  it('/health는 인증 없이 200', async () => {
    const response = await request(httpServer()).get('/health').expect(200)

    expect(response.body).toMatchObject({ status: 'ok', service: 'api' })
  })
})
