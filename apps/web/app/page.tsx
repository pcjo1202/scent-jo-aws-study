// 이 화면의 내용은 api의 라이브 상태다 (`version`이 api의 커밋 sha다). 정적으로 구우면
// 값이 배포 시점에 박히고, 무엇보다 **빌드가 api 가용성에 묶인다** — 정적 프리렌더에서는
// `useSuspenseQuery`가 빌드 중에 api를 부르고 그 거절이 export를 죽인다 (SJO-49).
export const dynamic = 'force-dynamic'

export { HomePage as default } from '@/_pages/home/ui/home-page'
