import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { describe, expect, it, vi } from 'vitest'

import { AppModule } from '../app.module'
import { IS_PUBLIC_KEY } from './public.decorator'

/**
 * `AppModule`을 import하는 것만으로 `ConfigModule.forRoot({ validate })`가 돈다. 이 파일이
 * 보는 것은 라우트 메타데이터뿐이라 값의 내용은 무관하지만, 없으면 import 자체가 죽는다.
 * `vi.hoisted`가 import보다 먼저 도는 유일한 자리다.
 *
 * 필수 키 검증은 `env.spec.ts`가 소유한다 — 여기서 주입한다고 그쪽이 느슨해지지 않는다.
 */
vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: 'postgres://audit:audit@127.0.0.1:5432/audit',
    SUPABASE_JWKS_URL: 'https://audit.invalid/auth/v1/.well-known/jwks.json',
    SUPABASE_JWT_ISSUER: 'https://audit.invalid/auth/v1',
    ALLOWED_EMAIL: 'audit@invalid',
    DATA_BASE_URL: 'https://audit.invalid/aws-saa',
  })
})

/**
 * `guard-coverage.spec.ts`가 미룬 나머지 절반이다 — 그 파일이 세는 것은 **자기가 만든**
 * 라우트라, 누군가 실제 컨트롤러에 `@Public()`을 잘못 붙이면 통과한다. 라우트가 `/health`
 * 하나뿐일 때 값이 작아 「도메인 라우트가 생긴 뒤」로 미뤄 뒀고, SJO-15가 6개를 만들었다.
 *
 * AppModule의 import 그래프를 걸어 컨트롤러를 전부 모으고 「N개 중 공개 M개」를 센다.
 * 이름을 열거하지 않고 그래프에서 뽑는 것이 핵심이다 — 목록을 손으로 적으면 다음에 생기는
 * 모듈이 목록에 없어 조용히 안 세어진다.
 */

type Constructor = new (...args: never[]) => unknown

type Route = { controller: string; handler: string; isPublic: boolean }

/**
 * import 항목은 세 모양으로 온다. 클래스만 세면 나머지 둘의 컨트롤러가 **감사에서
 * 통째로 빠지고 라우트 수도 안 늘어** 그 자리의 `@Public()`이 안 잡힌다 — 지금 앱에
 * 동적 모듈은 컨트롤러 없는 `ConfigModule.forRoot()` 하나뿐이라 아직 구멍은 아니지만,
 * 열거하지 않은 경로는 다음에 붙는 모듈에서 구멍이 된다.
 */
function toModule(imported: unknown): Constructor | undefined {
  if (typeof imported === 'function') return imported as Constructor
  if (typeof imported !== 'object' || imported === null) return undefined

  // X.forRoot()·register()가 돌려주는 { module, controllers, ... }
  if ('module' in imported) return toModule(imported.module)

  // forwardRef(() => X)
  if ('forwardRef' in imported) {
    return toModule((imported as { forwardRef: () => unknown }).forwardRef())
  }

  return undefined
}

function controllersOf(imported: unknown): Constructor[] {
  if (typeof imported !== 'object' || imported === null || !('controllers' in imported)) return []

  return ((imported as { controllers?: Constructor[] }).controllers ?? []).filter(
    (entry) => typeof entry === 'function',
  )
}

function collectControllers(root: Constructor): Constructor[] {
  const seen = new Set<Constructor>()
  const controllers: Constructor[] = []
  const pending: Constructor[] = [root]

  while (pending.length > 0) {
    const module = pending.pop()
    if (module === undefined || seen.has(module)) continue
    seen.add(module)

    const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? []) as unknown[]
    for (const imported of imports) {
      const resolved = toModule(imported)
      if (resolved !== undefined) pending.push(resolved)

      // 동적 모듈은 컨트롤러를 클래스 메타데이터가 아니라 **자기 객체**에 담아 온다.
      controllers.push(...controllersOf(imported))
    }

    const own = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []) as Constructor[]
    controllers.push(...own)
  }

  return controllers
}

function routesOf(controller: Constructor): Route[] {
  const isControllerPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true
  const prototype = controller.prototype as object

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => Reflect.get(prototype, name) as Constructor)
    .filter((handler) => Reflect.getMetadata(METHOD_METADATA, handler) !== undefined)
    .map((handler) => ({
      controller: controller.name,
      handler: handler.name,
      isPublic: isControllerPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
    }))
}

const ROUTES = collectControllers(AppModule as unknown as Constructor).flatMap(routesOf)

/** 도메인 라우트 6개 + `/health`. 늘리는 이슈가 이 숫자를 같이 고친다. */
const EXPECTED_ROUTE_COUNT = 7

describe('AppModule의 @Public() 감사', () => {
  it('라우트를 실제로 찾았다 — 0건은 통과가 아니다', () => {
    expect(ROUTES).toHaveLength(EXPECTED_ROUTE_COUNT)
  })

  it('공개 라우트는 GET /health 하나뿐이다', () => {
    const open = ROUTES.filter((route) => route.isPublic)

    expect(open).toEqual([{ controller: 'AppController', handler: 'getHealth', isPublic: true }])
  })

  it('나머지 라우트는 전부 전역 가드가 막는다', () => {
    const guarded = ROUTES.filter((route) => !route.isPublic)

    expect(guarded).toHaveLength(EXPECTED_ROUTE_COUNT - 1)
  })
})

it('감사가 보는 것이 실제 경로다', () => {
  const paths = collectControllers(AppModule as unknown as Constructor).map(
    (controller) => Reflect.getMetadata(PATH_METADATA, controller) as string,
  )

  expect(new Set(paths)).toEqual(new Set(['/', 'me', 'attempts', 'stats']))
})
