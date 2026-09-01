import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { jwtVerify } from 'jose'

import { JwksService } from './jwks.service'
import { IS_PUBLIC_KEY } from './public.decorator'

const SUPABASE_AUDIENCE = 'authenticated'
const BEARER_PREFIX = 'Bearer '

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
    this.allowedEmail = configService.getOrThrow<string>('ALLOWED_EMAIL')
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
    if (user.email !== this.allowedEmail) {
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
      })

      return payload
    } catch (error) {
      // 실패 원인은 응답에 담지 않는다. JWKS 조회 실패는 모든 요청을 401로 만드는데
      // 응답만 봐서는 만료된 토큰과 구분되지 않으므로 로그에 남긴다.
      this.logger.warn(`JWT 검증 실패: ${error instanceof Error ? error.message : String(error)}`)

      throw new UnauthorizedException('토큰을 검증할 수 없다')
    }
  }
}
