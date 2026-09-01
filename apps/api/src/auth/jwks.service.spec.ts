import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { ConfigService } from '@nestjs/config'
import { SignJWT, exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { JwksService } from './jwks.service'

const KID = 'signing-key'

let server: Server
let jwksUrl: string
let requestCount = 0
let token: string

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
  const jwks = JSON.stringify({
    keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', use: 'sig', kid: KID }],
  })

  token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: KID }).sign(privateKey)

  // 스파이가 아니라 실제 서버를 세워 센다 — jose는 global fetch가 아니라 자체 http 호출을 쓴다
  server = createServer((_request, response) => {
    requestCount += 1
    response.writeHead(200, { 'content-type': 'application/json' }).end(jwks)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  jwksUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/auth/v1/.well-known/jwks.json`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

it('공개키를 요청마다 받지 않는다 — 연속 검증에 네트워크는 한 번', async () => {
  const service = new JwksService(new ConfigService({ SUPABASE_JWKS_URL: jwksUrl }))

  await jwtVerify(token, service.resolveKey)
  await jwtVerify(token, service.resolveKey)
  await jwtVerify(token, service.resolveKey)

  expect(requestCount).toBe(1)
})
