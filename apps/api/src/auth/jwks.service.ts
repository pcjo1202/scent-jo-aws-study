import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet } from 'jose'
import type { JWTVerifyGetKey } from 'jose'

/**
 * 공개키를 요청마다 받지 않는다. `createRemoteJWKSet`이 `kid` 매칭·캐시·쿨다운을 이미 갖고
 * 있어 캐시를 직접 두지 않는다.
 *
 * 서명은 **ES256(EC P-256)** 이다 — RS256이 아니다 (docs/07 §1, 2026-08-31 실측).
 */
@Injectable()
export class JwksService {
  readonly resolveKey: JWTVerifyGetKey

  constructor(configService: ConfigService) {
    const jwksUrl = configService.getOrThrow<string>('SUPABASE_JWKS_URL')

    this.resolveKey = createRemoteJWKSet(new URL(jwksUrl))
  }
}
