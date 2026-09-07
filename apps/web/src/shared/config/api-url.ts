import { withRelatedProject } from '@vercel/related-projects'

const DEFAULT_API_URL = 'http://localhost:3001'

/**
 * 서버 컴포넌트가 풀어서 화면에 내려 주는 값이다. **`NEXT_PUBLIC_`이 아닌 것을 읽으므로
 * 브라우저에서 부르지 않는다** — 프리뷰가 짝이 맞는 api를 부르려면 `VERCEL_RELATED_PROJECTS`를
 * 풀어야 하는데 그건 서버에서만 보인다 (`docs/03` 「프로젝트 간 URL 연결」).
 *
 * `env.ts`가 아니라 이 파일에 있는 이유: `env.ts`는 클라이언트 컴포넌트도 부르는데, 여기서
 * 가져오는 `@vercel/related-projects`가 그 번들로 딸려 들어갈 이유가 없다.
 */
export function resolveApiUrl(): string {
  return withRelatedProject({
    projectName: 'aws-study-api',
    defaultHost: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
  })
}
