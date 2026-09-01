import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { errors, jwtVerify } from 'jose'

import { JwksService } from './jwks.service'
import { IS_PUBLIC_KEY } from './public.decorator'

const SUPABASE_AUDIENCE = 'authenticated'
const BEARER_PREFIX = 'Bearer '

/**
 * 토큰 자체가 잘못됐다는 뜻인 오류들. 나머지(JWKS 조회 실패·타임아웃·JWKS가 아닌 응답)는
 * 의존 서비스 장애이므로 401이 아니라 503이다 — 401로 뭉개면 프론트가 세션 만료로 읽고
 * 재로그인 루프에 빠지는데, 새 토큰을 받아와도 원인이 서버 쪽이라 또 401이 된다.
 * 모르는 오류는 401이 아니라 503으로 떨어뜨린다 (allowlist).
 */
const TOKEN_ERROR_CODES = new Set([
  errors.JWTExpired.code,
  errors.JWTClaimValidationFailed.code,
  errors.JWSSignatureVerificationFailed.code,
  errors.JWKSNoMatchingKey.code,
  errors.JOSENotSupported.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JWSInvalid.code,
  errors.JWTInvalid.code,
])

export interface AuthUser {
  id: string
  email: string
}

export interface AuthenticatedRequest {
  headers: { authorization?: string }
  user?: AuthUser
}

function readBearerToken(header: string | undefined) {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return undefined
  }

  return header.slice(BEARER_PREFIX.length)
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name)
  private readonly issuer: string
  private readonly allowedEmail: string

  constructor(
    private readonly reflector: Reflector,
    private readonly jwks: JwksService,
    configService: ConfigService,
  ) {
    this.issuer = configService.getOrThrow<string>('SUPABASE_JWT_ISSUER')
    // 대시보드에 손으로 넣는 값이라 대문자 한 글자·끝 공백 하나면 소유자 본인이 403으로 잠긴다
    this.allowedEmail = configService.getOrThrow<string>('ALLOWED_EMAIL').trim().toLowerCase()
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = readBearerToken(request.headers.authorization)

    if (token === undefined) {
      throw new UnauthorizedException('인증 토큰이 없다')
    }

    const user = await this.readUser(token)

    // 로그인은 아무 구글 계정이나 되지만 API는 소유자만 통과시킨다 (docs/05 「API 계약」)
    if (user.email.toLowerCase() !== this.allowedEmail) {
      throw new ForbiddenException('허용되지 않은 계정이다')
    }

    request.user = user

    return true
  }

  private async readUser(token: string): Promise<AuthUser> {
    const payload = await this.verifySignature(token)
    const { sub, email } = payload

    if (typeof sub !== 'string' || typeof email !== 'string') {
      throw new UnauthorizedException('토큰에 sub·email 클레임이 없다')
    }

    return { id: sub, email }
  }

  private async verifySignature(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.jwks.resolveKey, {
        issuer: this.issuer,
        audience: SUPABASE_AUDIENCE,
        // 없으면 jose가 만료 검사를 통째로 건너뛴다. Supabase가 늘 넣는다는 기대를 없앤다
        requiredClaims: ['exp'],
      })

      return payload
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      if (!(error instanceof errors.JOSEError) || !TOKEN_ERROR_CODES.has(error.code)) {
        this.logger.error(`JWKS 검증 경로 실패: ${reason}`)

        throw new ServiceUnavailableException('인증 서버에 연결할 수 없다')
      }

      // 실패 원인은 응답에 담지 않는다 — 401만으로는 무엇이 틀렸는지 알 수 없어 로그에 남긴다
      this.logger.warn(`JWT 검증 실패: ${reason}`)

      throw new UnauthorizedException('토큰을 검증할 수 없다')
    }
  }
}
