/** 문항 선택지 키. 원본 문제은행이 A~F를 쓴다 (`01-requirements.md` 「문제은행」). */
export type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/** 답안을 제출한 맥락. `05-database.md`의 attempts.source와 같다. */
export type AttemptSource = 'sequential' | 'review' | 'exam'

/** GET /health — M0 배포 검증에 쓴다. */
export type HealthResponse = {
  status: 'ok'
  service: 'api'
  version: string
}

/** CDN에 올라가는 문항 하나 (`04-data-model.md` 「Question」). */
export type Question = {
  id: number
  stem: string
  choices: Choice[]
  /** 1~3개. */
  answer: ChoiceKey[]
  requirements: string[]
  explanation: string
  /** 정답 선택지에는 오답 해설이 없어 `choices`보다 짧다. */
  rebuttals: Choice[]
  /** 파생. 0~3개 — 노트에 없는 개념만 언급하는 문항은 빈다. */
  categories: string[]
  /** 파생. 매칭된 서비스명. */
  services: string[]
}

export type Choice = { key: ChoiceKey; text: string }

/** `04-data-model.md` 「chunk-NNN.json」. 100문항 단위, 마지막 청크만 19문항이다. */
export type Chunk = {
  chunk: number
  from: number
  to: number
  questions: Question[]
}

/** `04-data-model.md` 「index.json」. 필터·목록과 서버 채점이 이 파일만 읽는다. */
export type IndexEntry = {
  id: number
  /** 이 문항이 든 청크 번호. id에서 계산하지 않아 청크 크기를 바꿔도 안 깨진다. */
  chunk: number
  categories: string[]
  services: string[]
  /** 채점용. `catalog`가 이 파일만 캐시하면 서버에서 채점할 수 있다. */
  answer: ChoiceKey[]
  /** 4~6. 범위 밖 선택지 키 제출을 서버가 400으로 거르는 데 쓴다. */
  choiceCount: number
}

export type QuestionIndex = { entries: IndexEntry[] }

/** `04-data-model.md` 「manifest.json」. 모든 데이터 접근의 진입점. */
export type Manifest = {
  version: string
  generatedAt: string
  base: string
  questions: { total: number; chunkSize: number; chunks: number }
  files: Record<string, { bytes: number; sha256: string }>
}

/**
 * 학습 기록 API의 요청·응답 (`05-database.md` 「API 계약」).
 *
 * 요청 타입은 `apps/api`의 class-validator DTO가 `implements`해 계약 정합을 강제한다
 * (`apps/api/CLAUDE.md` 「DTO는 이 앱이 소유한다」). `userId`는 어느 요청에도 없다 —
 * 항상 토큰의 `sub`에서 온다.
 */
export type CreateAttemptRequest = {
  questionId: number
  selected: ChoiceKey[]
  source: AttemptSource
  /** `source`가 `'exam'`이면 필수. */
  sessionId?: string
  durationMs?: number
  /** `sequential` 전용. 기본 true, 필터 모드는 false. */
  advancesPointer?: boolean
}

/** 오프라인 큐 재전송. `answeredAt`(클라이언트 발생 시각)이 `created_at`이 된다. */
export type BatchAttemptItem = CreateAttemptRequest & {
  /** ISO 8601. */
  answeredAt: string
}

export type CreateAttemptBatchRequest = { items: BatchAttemptItem[] }

/** `sequential`·`review`의 응답. exam은 정오를 돌려주지 않는다. */
export type AttemptResponse = { isCorrect: boolean; answer: ChoiceKey[] }

export type ExamAttemptResponse = { accepted: true }

/** `rejected` 항목은 클라이언트가 큐에서 버린다 — 재시도는 네트워크 오류만이다. */
export type BatchAttemptResult = {
  index: number
  status: 'saved' | 'rejected'
  isCorrect?: boolean
}

export type CreateAttemptBatchResponse = { results: BatchAttemptResult[] }

export type ProgressResponse = {
  /** 순차 진도 포인터. 이어풀기·완주 판정용. */
  lastQuestionId: number
  /** 한 번이라도 푼 서로 다른 문항 수. `source` 무관 (`05` 「풀이 상태 맵」). */
  solvedCount: number
  wrongCount: number
  activeSessionId: string | null
}

/** 안 푼 문항은 키가 없다. */
export type QuestionStatesResponse = { states: Record<number, 'correct' | 'wrong'> }

export type WrongQuestionsResponse = { questionIds: number[] }

/** 문항은 자기 카테고리 전부에 산입된다 — `sum(total)`이 문항 수보다 크다. */
export type CategoryStats = {
  category: string
  total: number
  solved: number
  correct: number
  /** `correct / solved`. `solved`가 0이면 0이다. */
  accuracy: number
}

export type StatsResponse = { byCategory: CategoryStats[] }
