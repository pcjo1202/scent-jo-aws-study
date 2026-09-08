const SESSION_TIME_ZONE = 'Asia/Seoul'

/**
 * **시간대를 고정한다.** 기기 시간대에 맡기면 서버(Vercel · UTC)가 그린 날짜와 브라우저가
 * 그린 날짜가 갈려 하이드레이션이 깨지고, 한국 아침에 시작한 세션이 하루 전으로 보인다.
 * 사용자는 한 명이고 그 사람이 쓰는 시간대는 하나다 (`docs/01` 「운영 환경」의 기기 2대).
 */
export function formatSessionDate(startedAt: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SESSION_TIME_ZONE,
    dateStyle: 'medium',
  }).format(new Date(startedAt))
}
