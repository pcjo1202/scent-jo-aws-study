import { withRelatedProject } from '@vercel/related-projects'

import { HealthStatus } from './health-status'

// 로컬 폴백. 배포에서는 VERCEL_RELATED_PROJECTS가 짝이 맞는 api를 가리킨다 (docs/03 §프로젝트 간 URL 연결).
const DEFAULT_API_URL = 'http://localhost:3001'

export function HomePage() {
  // VERCEL_RELATED_PROJECTS는 NEXT_PUBLIC_이 아니라 클라이언트 번들에 들어가지 않는다.
  // 서버에서 풀어 prop으로 내린다 — 클라이언트에서 부르면 배포에서도 항상 폴백이 된다.
  const apiUrl = withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })

  return (
    <main>
      <h1>AWS SAA-C03 학습</h1>
      <HealthStatus apiUrl={apiUrl} />
    </main>
  )
}
