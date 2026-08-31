import { describe, expect, it } from 'vitest'
import { joinWrappedLines } from './join-wrapped-lines.ts'

describe('joinWrappedLines', () => {
  it('라틴·숫자 사이는 띄운다 — 줄바꿈이 곧 단어 경계다', () => {
    expect(joinWrappedLines(['the quick brown', 'fox jumps'])).toBe('the quick brown fox jumps')
  })

  it('한글 이음매는 오라클에 맡기고, 오라클이 없으면 붙인다', () => {
    expect(joinWrappedLines(['업로드를', '사용하여'])).toBe('업로드를사용하여')
    expect(joinWrappedLines(['업로드를', '사용하여'], () => true)).toBe('업로드를 사용하여')
  })

  /**
   * 줄 끝 하이픈은 토큰이 이어진다는 뜻이다 — PDF가 리전명·스토리지 클래스를
   * 하이픈에서 접는다. 여기에 공백을 넣으면 서비스명이 쪼개져 태깅까지 깨진다.
   */
  it('줄이 하이픈으로 끝나면 붙인다 — 리전명·서비스명이 하이픈에서 접힌다', () => {
    expect(joinWrappedLines(['ap-', 'northeast-2'])).toBe('ap-northeast-2')
    expect(joinWrappedLines(['S3 Standard-', 'Infrequent Access'])).toBe(
      'S3 Standard-Infrequent Access',
    )
    expect(joinWrappedLines(['(SSE-', 'KMS)'])).toBe('(SSE-KMS)')
  })

  it('하이픈 앞이 한글이어도 붙인다 — 코퍼스의 하이픈 줄바꿈은 전부 토큰 안쪽이다', () => {
    expect(joinWrappedLines(['버킷-', '간 복제'])).toBe('버킷-간 복제')
  })

  it('ASCII 화살표가 하이픈에서 갈려도 되붙는다', () => {
    expect(joinWrappedLines(['Lambda -', '> 다음 단계'])).toBe('Lambda -> 다음 단계')
  })

  it('코드 줄은 잇지 않고 상대 들여쓰기만 남긴다', () => {
    const joined = joinWrappedLines(['    {', '      "Effect": "Allow"', '    }'])

    expect(joined).toBe('{\n  "Effect": "Allow"\n}')
  })
})
