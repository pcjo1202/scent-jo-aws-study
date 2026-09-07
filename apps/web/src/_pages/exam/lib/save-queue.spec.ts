import { describe, expect, it } from 'vitest'

import { createSaveQueue } from './save-queue'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('createSaveQueue', () => {
  it('앞 요청이 끝나기 전에는 다음 요청을 시작하지 않는다', async () => {
    const enqueue = createSaveQueue()
    const first = deferred()
    const started: string[] = []

    const firstDone = enqueue(async () => {
      started.push('first')
      await first.promise
    })
    const secondDone = enqueue(async () => {
      started.push('second')
    })

    await Promise.resolve()
    // 늦게 시작한 요청이 먼저 커밋되면 마지막 답이 뒤집힌다 — 그래서 아직 시작하면 안 된다.
    expect(started).toEqual(['first'])

    first.resolve()
    await Promise.all([firstDone, secondDone])
    expect(started).toEqual(['first', 'second'])
  })

  it('앞이 실패해도 다음은 돌고, 실패는 그 호출부에만 던진다', async () => {
    const enqueue = createSaveQueue()
    const failed = enqueue(() => Promise.reject(new Error('네트워크')))
    const next = enqueue(() => Promise.resolve('저장됨'))

    await expect(failed).rejects.toThrow('네트워크')
    await expect(next).resolves.toBe('저장됨')
  })
})
