import { describe, expect, it, vi } from 'vitest'

const { postgresMock } = vi.hoisted(() => ({ postgresMock: vi.fn(() => ({})) }))

vi.mock('postgres', () => ({ default: postgresMock }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({})) }))

import { createDb } from './db.provider'

describe('createDb', () => {
  it('드라이버에 prepare: false를 넘긴다', () => {
    createDb('postgresql://user:pw@pooler.example.com:6543/postgres')

    expect(postgresMock).toHaveBeenCalledWith(
      'postgresql://user:pw@pooler.example.com:6543/postgres',
      { prepare: false },
    )
  })
})
