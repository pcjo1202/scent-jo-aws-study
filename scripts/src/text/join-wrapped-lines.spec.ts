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

  it('슬래시로 끝나면 붙인다 — A/B 복합어가 슬래시에서 접힌다', () => {
    expect(joinWrappedLines(['내구성/', '고가용성 요건'])).toBe('내구성/고가용성 요건')
    expect(joinWrappedLines(['TCP/', 'UDP 포트'])).toBe('TCP/UDP 포트')
  })

  it('띄어 쓴 슬래시는 구분자라 그대로 띄운다 — 비교노트의 신호 목록', () => {
    expect(joinWrappedLines(['신호 하나 /', '신호 둘'])).toBe('신호 하나 / 신호 둘')
  })

  it('다음 줄이 조사로 시작하면 앞말에 붙인다 — 라틴 토큰과 조사가 갈리면 안 된다', () => {
    expect(joinWrappedLines(['Amazon EC2', '를 사용한다'])).toBe('Amazon EC2를 사용한다')
    expect(joinWrappedLines(['(ARN)', '은 고유하다'])).toBe('(ARN)은 고유하다')
    expect(joinWrappedLines(['NLB', '에서 처리한다'])).toBe('NLB에서 처리한다')
  })

  it('조사처럼 생겼어도 어절이 이어지면 띄운다 — «인스턴스»는 조사가 아니다', () => {
    expect(joinWrappedLines(['Amazon EC2', '인스턴스를 만든다'])).toBe(
      'Amazon EC2 인스턴스를 만든다',
    )
    expect(joinWrappedLines(['NLB', '와의 연결'])).toBe('NLB와의 연결')
    expect(joinWrappedLines(['DB', '로드가 높다'])).toBe('DB 로드가 높다')
  })

  it('«이»는 붙이지 않는다 — 조사와 지시관형사가 섞여 반례가 있다', () => {
    // "이 요구사항"의 «이»는 조사가 아니다. 붙이면 오히려 틀린다.
    expect(joinWrappedLines(['(비용 효율적)', '이 요구사항을 만족한다'])).toBe(
      '(비용 효율적) 이 요구사항을 만족한다',
    )
    expect(joinWrappedLines(['(ARN)', '이 필요하다'])).toBe('(ARN) 이 필요하다')
  })

  it('코드 줄은 잇지 않고 상대 들여쓰기만 남긴다', () => {
    const joined = joinWrappedLines(['    {', '      "Effect": "Allow"', '    }'])

    expect(joined).toBe('{\n  "Effect": "Allow"\n}')
  })
})
