import { Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { expect, it } from 'vitest'

/**
 * 라우팅 테스트가 아니라 **툴링 회귀 테스트**다 (apps/api/CLAUDE.md 「테스트」의 치명 영역과 별개).
 * emitDecoratorMetadata가 죽으면 Nest는 생성자 인자의 타입을 잃고 DI가 통째로 깨지는데,
 * 그때 실패하는 것이 이 파일 하나뿐이면 원인을 바로 안다.
 */

@Injectable()
class Dependency {
  value() {
    return 'injected'
  }
}

@Injectable()
class Consumer {
  constructor(private readonly dependency: Dependency) {}

  read() {
    return this.dependency.value()
  }
}

it('생성자 주입이 동작한다 — SWC가 design:paramtypes를 남긴다', async () => {
  const moduleRef = await Test.createTestingModule({ providers: [Dependency, Consumer] }).compile()

  expect(moduleRef.get(Consumer).read()).toBe('injected')
})
