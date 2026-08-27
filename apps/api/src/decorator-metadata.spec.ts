import { Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { expect, it } from 'vitest'

// 툴링 회귀 테스트 (apps/api/CLAUDE.md 「테스트」의 예외 조항).

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
